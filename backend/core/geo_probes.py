"""Real measurements of how an AI answer engine sees a brand.

GEO's whole premise is that being found now means being *named in a generated answer*, not
ranked on a page. That is measurable — you ask a model the questions a buyer would ask and
see whether the brand comes back — and the pipeline was not measuring it. The Citation,
Prompt Visibility and Optimization nodes slept for a second each while logging claims about
cross-referencing Perplexity datasets and auditing fifty prompt structures.

These functions do the thing. They query the model the product already uses (Gemini) and
return counts and verbatim answers, so a reader can check the finding rather than take it.

Two limits stated plainly, because a GEO number that overclaims is worse than none:

  * One model, not four. This probes Gemini, which is what the workspace has credentials
    for. It is a real answer engine and a reasonable proxy, but it is not ChatGPT, Perplexity
    and Claude, and every result here says which model produced it.
  * Training knowledge, not live retrieval. The probes ask what the model knows, so they
    measure the brand's presence in model weights — which is exactly the GEO question — and
    not what a retrieval-augmented product would surface today.

Nothing raises. A failed probe returns ok=False with the reason and the pipeline reports it
as unmeasured rather than as a zero.
"""
import json
import re

from core.providers.llm_providers import GeminiProvider

# Deliberately the family, not a version. GeminiProvider.generate_text falls through to other
# Gemini models when the requested one is rate-limited or retired, and does not report which
# one served the call — so naming "gemini-2.5-flash" in a customer-facing finding was a claim
# this code cannot stand behind. A real run hit the free-tier daily cap and was answered by
# gemini-flash-latest while the report said otherwise.
MODEL_LABEL = "Gemini"

_NO_TOOLS = (
    "You are an AI answer engine responding from your own training knowledge only. "
    "You have no web access and no tools. Never guess, never invent a company, and never "
    "fabricate sources — if you do not know, say so explicitly."
)


def _brand_names(url: str, brand_name: str = "") -> list:
    """The strings that count as 'the brand was named' in an answer."""
    from urllib.parse import urlparse
    host = (urlparse(url).netloc or url or "").lower().replace("www.", "")
    root = host.split(".")[0] if host else ""
    names = {n.lower() for n in (brand_name or "", host, root) if n and len(n) > 2}
    return sorted(names)


def _mentions(text: str, names: list) -> bool:
    low = (text or "").lower()
    return any(n in low for n in names)


def _json_block(raw: str):
    """Pull a JSON array/object out of a model reply that may be fenced, prefaced or cut off.

    The truncation case is not hypothetical. These calls originally passed max_output_tokens,
    and on gemini-2.5-flash that budget is spent on thinking tokens first — a 400-token cap
    returned 48 characters, `["What are the best power banks under`, and every probe failed.
    The caps are gone (see the call sites), but a reply can still end mid-structure for
    reasons outside this code's control, and losing five usable answers because the sixth was
    clipped is a waste of a model call.

    So: strict parse first, and only if that fails, salvage the elements that did arrive.
    """
    if not raw:
        return None
    fenced = re.search(r"```(?:json)?\s*(.+?)```", raw, re.S)
    candidate = (fenced.group(1) if fenced else raw).strip()
    start = min([i for i in (candidate.find("["), candidate.find("{")) if i != -1], default=-1)
    if start == -1:
        return None
    body = candidate[start:]

    try:
        return json.loads(body)
    except Exception:
        pass
    # Longest valid prefix — handles trailing prose after a complete structure.
    for end in range(len(body), start, -1):
        try:
            return json.loads(body[:end])
        except Exception:
            continue
    # Truncated. Close the structure after the last element that parsed cleanly.
    if body.startswith("["):
        for cut in range(len(body) - 1, 0, -1):
            if body[cut] in ",]":
                try:
                    return json.loads(body[:cut].rstrip().rstrip(",") + "]")
                except Exception:
                    continue
    return None


async def probe_prompt_visibility(url: str, brand_name: str = "", category: str = "",
                                  n_prompts: int = 5) -> dict:
    """Does the brand get named when a buyer asks the questions it should win?

    Two calls, not n+1: one to write the prompts a real buyer in this category would type,
    one to answer them all in a single JSON reply. Answering them in one pass also keeps the
    comparison fair — the same context produces every answer.
    """
    names = _brand_names(url, brand_name)
    out = {"ok": False, "model": MODEL_LABEL, "prompts": [], "mentioned_in": 0,
           "total": 0, "visibility_pct": 0.0, "answers": [], "error": None,
           "brand_terms": names}
    try:
        llm = GeminiProvider()
        topic = (category or "").strip() or f"the business at {url}"
        gen = await llm.generate_text(
            prompt=(f"A potential customer is looking for {topic}. Write {n_prompts} short, "
                    f"realistic questions they would type into an AI assistant when choosing "
                    f"a provider or product. Do not name any specific company. "
                    f"Reply with ONLY a JSON array of strings."),
            system_prompt="You write realistic buyer-intent search prompts. Reply with JSON only.",
            # No max_output_tokens: on gemini-2.5-flash that budget is consumed by
            # thinking tokens before any text is emitted, so a cap here truncates the
            # JSON mid-structure. Length is bounded by the instruction instead.
        )
        prompts = _json_block(gen)
        if not isinstance(prompts, list) or not prompts:
            out["error"] = "Could not generate probe prompts."
            return out
        prompts = [str(p)[:200] for p in prompts[:n_prompts]]
        out["prompts"] = prompts

        answered = await llm.generate_text(
            prompt=("Answer each question below the way you normally would, naming the specific "
                    "companies, products or sites you would actually recommend. If you do not "
                    "know of any, say so.\n\n"
                    + "\n".join(f"{i+1}. {p}" for i, p in enumerate(prompts))
                    + "\n\nReply with ONLY a JSON array of objects: "
                      '[{"question": "...", "answer": "..."}]'),
            system_prompt=_NO_TOOLS + " Reply with JSON only.",
        )
        rows = _json_block(answered)
        if not isinstance(rows, list):
            rows = [{"question": p, "answer": answered or ""} for p in prompts]

        hits = 0
        for r in rows:
            if not isinstance(r, dict):
                continue
            ans = str(r.get("answer", ""))
            hit = _mentions(ans, names)
            hits += 1 if hit else 0
            out["answers"].append({"question": str(r.get("question", ""))[:200],
                                   "mentioned": hit, "answer": ans[:500]})
        out["total"] = len(out["answers"]) or len(prompts)
        out["mentioned_in"] = hits
        out["visibility_pct"] = round(hits / out["total"] * 100, 1) if out["total"] else 0.0
        out["ok"] = True
    except Exception as e:
        out["error"] = str(e)[:200]
    return out


async def probe_citations(url: str, brand_name: str = "") -> dict:
    """What would the model cite as a source about this brand — and is the brand's own site
    among it? A brand an answer engine cannot source is a brand it will not name."""
    names = _brand_names(url, brand_name)
    out = {"ok": False, "model": MODEL_LABEL, "knows_brand": False,
           "cites_own_site": False, "sources": [], "raw": None, "error": None}
    try:
        llm = GeminiProvider()
        # Naming each source as a concrete domain is required, not stylistic. Asked openly,
        # the model answers with categories — "Its own site", "News coverage", "Directories" —
        # and the self-citation check below then looks for the brand inside the string "Its
        # own site" and finds nothing, so a run reported five sources and, in the same
        # sentence, that the brand's own site was not among them.
        raw = await llm.generate_text(
            prompt=(f"Think about the brand or company at {url}"
                    + (f" ({brand_name})" if brand_name else "") + ". "
                    "Which sources would you cite if asked about it? "
                    'Reply with ONLY JSON: {"knows_brand": true/false, "sources": ["..."]}. '
                    "Each source MUST be a concrete domain or URL you could actually name "
                    "(for example \"example.com\" or \"en.wikipedia.org/wiki/Example\") — never "
                    "a category like \"its own site\", \"news coverage\" or \"directories\". "
                    "If you have no knowledge of this brand, return knows_brand false and an "
                    "empty sources list. Do not invent sources."),
            system_prompt=_NO_TOOLS + " Reply with JSON only.",
        )
        out["raw"] = (raw or "")[:800]
        data = _json_block(raw) or {}
        if isinstance(data, dict):
            out["knows_brand"] = bool(data.get("knows_brand"))
            srcs = data.get("sources") or []
            out["sources"] = [str(s)[:160] for s in srcs][:10] if isinstance(srcs, list) else []
        # Belt and braces: a model that still answers with a category is read correctly rather
        # than counted as "does not cite its own site", which is a different and worse claim.
        _self_phrases = ("its own site", "own website", "official site", "official website",
                         "the brand's website", "company website", "their website")
        out["cites_own_site"] = any(
            _mentions(s, names) or any(p in s.lower() for p in _self_phrases)
            for s in out["sources"])
        out["ok"] = True
    except Exception as e:
        out["error"] = str(e)[:200]
    return out


async def draft_optimizations(url: str, brand: str, findings: str) -> dict:
    """Concrete content to add, grounded in what the audit actually measured.

    Given the measured gaps rather than a blank prompt, so the model is rewriting real
    findings instead of inventing a plausible-sounding list of best practices.
    """
    out = {"ok": False, "model": MODEL_LABEL, "markdown": None, "error": None}
    try:
        llm = GeminiProvider()
        md = await llm.generate_text(
            prompt=(f"Target: {url}\n\nCOMPANY CONTEXT:\n{brand}\n\n"
                    f"MEASURED FINDINGS FROM THIS AUDIT (these are real measurements — write "
                    f"only about these, do not introduce findings of your own):\n{findings}\n\n"
                    "Write the specific content to ADD to this page so an AI answer engine can "
                    "describe and cite it. Give literal, paste-ready text — a one-paragraph "
                    "definition of what this is and who it is for, 3 FAQ question/answer pairs "
                    "in the customers' own words, and one factual summary block. Markdown only, "
                    "no preamble, no commentary on the findings."),
            system_prompt=("You write copy that answer engines can extract and quote. Concrete "
                           "and factual; never invent statistics, prices, awards or claims that "
                           "are not in the context you were given."),
        )
        out["markdown"] = (md or "").strip() or None
        out["ok"] = bool(out["markdown"])
    except Exception as e:
        out["error"] = str(e)[:200]
    return out
