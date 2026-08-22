import asyncio
import re
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END

# Assuming `manager` from core.websocket is used to broadcast logs
from core.websocket import manager, current_workspace_id
import os
import httpx
from core.providers.llm_providers import GeminiProvider
from core.providers.base import LLMProviderError

# --- Schema Definitions ---

class OnboardingState(TypedDict):
    workspace_id: int
    brand_url: str
    brand_logo: Optional[str]
    guidelines_url: Optional[str]
    # Intermediate state
    scraped_content: str
    scraped_pages: List[dict]   # up to 5 crawled pages: [{"url": str, "content": str}]
    vision_insights: dict
    # Final structured outputs for DB
    typography: dict
    color_palette: list
    brand_guidelines_summary: str
    target_audience: str
    logs: List[str]
    status: str

# --- Node Definitions ---

def _html_to_text(html: str) -> str:
    """Crude but dependency-free HTML -> text: drop scripts/styles/tags, collapse whitespace."""
    import re
    html = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    # Decode the handful of entities that matter for prose
    for ent, ch in [("&amp;", "&"), ("&nbsp;", " "), ("&quot;", '"'), ("&#39;", "'"), ("&lt;", "<"), ("&gt;", ">")]:
        html = html.replace(ent, ch)
    return re.sub(r"\s+", " ", html).strip()


# Shallow crawl config: homepage + up to (MAX-1) same-domain pages.
_MAX_KB_PAGES = 5
_PER_PAGE_CHARS = 3000
_UA = "Mozilla/5.0 (compatible; RaftraBot/1.0)"

# A page has to be worth embedding. Error bodies are the trap: a crawler that renders
# JavaScript returns the site's 404 page as ordinary content, and once embedded a stub
# like "Not Found" scores against every query and crowds real brand content out of the
# top-k results. It also lands in scraped_content, so the LLM synthesizes the brand
# profile partly from error text.
_MIN_PAGE_WORDS = 20

_ERROR_PAGE_OPENER_RE = re.compile(
    r"^\s*(?:error\s*)?(?:\d{3}\b\s*[-:|]?\s*)?"
    r"(not found|page not found|forbidden|unauthorized|access denied|bad request|"
    r"internal server error|service unavailable|gateway time-?out|too many requests)",
    re.I,
)


def _is_useful_page(text: str) -> bool:
    """True if `text` looks like real page content rather than an error or empty shell."""
    stripped = _html_to_text(text or "")
    words = stripped.split()
    if len(words) < _MIN_PAGE_WORDS:
        return False
    # Wordier error pages ("404 - Page Not Found. The page you requested...") clear the
    # word count, so also reject anything that *opens* with an error phrase and is short
    # enough that it can't plausibly be real content too.
    if len(words) < 60 and _ERROR_PAGE_OPENER_RE.match(stripped):
        return False
    return True


def _extract_internal_links(html: str, base_url: str, limit: int) -> list:
    """Same-domain content links found on the page — used for a shallow crawl."""
    import re, urllib.parse
    base_host = (urllib.parse.urlparse(base_url).netloc or "").lower().replace("www.", "")
    base_norm = base_url.rstrip("/")
    seen, out = set(), []
    for m in re.finditer(r'href=["\']([^"\']+)["\']', html or "", re.I):
        href = m.group(1).strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absu = urllib.parse.urljoin(base_url, href)
        pu = urllib.parse.urlparse(absu)
        if pu.scheme not in ("http", "https"):
            continue
        if (pu.netloc or "").lower().replace("www.", "") != base_host:
            continue
        clean = pu._replace(fragment="").geturl()
        if clean.rstrip("/") == base_norm or clean in seen:
            continue
        if re.search(r"\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|css|js|mp4|woff2?)(\?|$)", clean, re.I):
            continue
        seen.add(clean)
        out.append(clean)
        if len(out) >= limit:
            break
    return out


async def _firecrawl_crawl(client, url: str, limit: int, key: str) -> list:
    """Crawl a site via Firecrawl's /v1/crawl endpoint — renders JavaScript (works on SPAs)
    and returns up to `limit` pages in one job. Returns [{'url','content'}]; [] on any failure
    so the caller can fall back to the direct link-crawl."""
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        start = await client.post(
            "https://api.firecrawl.dev/v1/crawl",
            headers=headers,
            json={"url": url, "limit": limit, "scrapeOptions": {"formats": ["markdown"]}},
        )
        if start.status_code not in (200, 201):
            print(f"Firecrawl crawl start failed: {start.status_code} {start.text[:150]}")
            return []
        j = start.json()
        crawl_id = j.get("id") or (j["url"].rstrip("/").split("/")[-1] if j.get("url") else None)
        if not crawl_id:
            return []
        # Crawl is async on Firecrawl's side — poll until it finishes (bounded).
        for _ in range(20):  # ~ up to 80s
            await asyncio.sleep(4)
            poll = await client.get(f"https://api.firecrawl.dev/v1/crawl/{crawl_id}",
                                    headers={"Authorization": f"Bearer {key}"})
            if poll.status_code != 200:
                continue
            pj = poll.json()
            status = pj.get("status")
            if status == "completed":
                out = []
                # Scan the whole result set rather than the first `limit` entries: if the
                # crawl surfaced error pages early, we still want `limit` good ones.
                for d in (pj.get("data") or []):
                    md = (d.get("markdown") or "").strip()
                    meta = d.get("metadata") or {}
                    src = meta.get("sourceURL") or meta.get("url") or url
                    # Firecrawl passes the origin's status through, and returns a 404 body
                    # as markdown just as happily as a real page — so check both.
                    status = meta.get("statusCode")
                    if status not in (None, 200, "200"):
                        print(f"Firecrawl: skipping {src} (HTTP {status})")
                        continue
                    if not _is_useful_page(md):
                        print(f"Firecrawl: skipping {src} (error page or near-empty)")
                        continue
                    out.append({"url": src, "content": md[:_PER_PAGE_CHARS]})
                    if len(out) >= limit:
                        break
                return out
            if status in ("failed", "cancelled"):
                print(f"Firecrawl crawl {status}")
                return []
        print("Firecrawl crawl did not finish in time; falling back to direct crawl.")
        return []
    except Exception as e:
        print(f"Firecrawl crawl error: {e}")
        return []


async def brand_intelligence_node(state: OnboardingState) -> OnboardingState:
    """
    Scrapes the brand URL. Prefers Firecrawl (clean markdown) when a key is set,
    otherwise falls back to fetching the page directly and extracting its text —
    so onboarding produces real brand content even with no external API keys.
    """
    msg = f"Initiating Brand Intelligence Agent for {state['brand_url']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Brand Intelligence", msg, "running")

    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    tavily_key = os.getenv("TAVILY_API_KEY")

    raw_url = (state.get("brand_url") or "").strip()
    url = raw_url if raw_url.startswith(("http://", "https://")) else ("https://" + raw_url if raw_url else "")

    async def _fetch_text(client, target: str, want_html: bool = False):
        """Return (text, html). Firecrawl markdown when a key is set, else a direct fetch."""
        html = ""
        text = ""
        if want_html or not firecrawl_key:
            try:
                r = await client.get(target)
                if r.status_code == 200:
                    html = r.text
                    text = _html_to_text(html)
            except Exception as e:
                print(f"Direct fetch failed for {target}: {e}")
        if firecrawl_key:
            try:
                fr = await client.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers={"Authorization": f"Bearer {firecrawl_key}", "Content-Type": "application/json"},
                    json={"url": target, "formats": ["markdown"]},
                )
                if fr.status_code == 200:
                    md = fr.json().get("data", {}).get("markdown", "")
                    if md:
                        text = md  # prefer clean markdown for the stored content
            except Exception as e:
                print(f"Firecrawl scrape failed for {target}: {e}")
        return text, html

    pages: List[dict] = []
    if url:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30, headers={"User-Agent": _UA}) as client:
            # 1) Preferred: Firecrawl crawl — renders JavaScript (handles SPAs) and returns
            #    up to _MAX_KB_PAGES pages in one job.
            if firecrawl_key:
                await manager.broadcast_agent_log("Brand Intelligence", f"Crawling {url} via Firecrawl (up to {_MAX_KB_PAGES} pages, JS-rendered)...", "thinking")
                pages = await _firecrawl_crawl(client, url, _MAX_KB_PAGES, firecrawl_key)
                if pages:
                    await manager.broadcast_agent_log("Brand Intelligence", f"Firecrawl returned {len(pages)} page(s).", "thinking")

            # 2) Fallback (no key, or Firecrawl returned nothing): fetch the homepage HTML and
            #    follow up to (MAX-1) same-domain links directly (no JS rendering).
            if not pages:
                await manager.broadcast_agent_log("Brand Intelligence", f"Scraping {url} directly...", "thinking")
                home_text, home_html = await _fetch_text(client, url, want_html=True)
                if home_text:
                    pages.append({"url": url, "content": home_text[:_PER_PAGE_CHARS]})
                links = _extract_internal_links(home_html, url, _MAX_KB_PAGES - 1)
                if links:
                    await manager.broadcast_agent_log("Brand Intelligence", f"Crawling {len(links)} more page(s) on the site...", "thinking")
                for link in links:
                    page_text, _ = await _fetch_text(client, link)
                    if page_text and len(page_text.split()) > 20:  # skip near-empty pages
                        pages.append({"url": link, "content": page_text[:_PER_PAGE_CHARS]})

            # 3) Optional external search context (Tavily) as one extra entry.
            if tavily_key:
                await manager.broadcast_agent_log("Brand Intelligence", "Adding competitor/search context via Tavily...", "thinking")
                try:
                    tv = await client.post(
                        "https://api.tavily.com/search",
                        json={"api_key": tavily_key, "query": f"Brand information and competitors for {url}"},
                    )
                    if tv.status_code == 200:
                        results = "\n".join([r.get("content", "") for r in tv.json().get("results", [])])
                        if results.strip():
                            pages.append({"url": "web-search:tavily", "content": results[:2000]})
                except Exception:
                    pass

    if not pages:
        await manager.broadcast_agent_log("Brand Intelligence", "Could not extract any content from the brand URL - the knowledge base will be limited for this workspace.", "failed")
        state["scraped_pages"] = []
        state["scraped_content"] = "No content extracted."
        return state

    await manager.broadcast_agent_log("Brand Intelligence", f"Extracted {len(pages)} page(s) into the knowledge base.", "completed")
    state["scraped_pages"] = pages
    # Aggregate for the LLM synthesis step (it reads scraped_content).
    state["scraped_content"] = "\n\n".join(f"[{p['url']}]\n{p['content']}" for p in pages)[:8000]
    return state

async def vision_analysis_node(state: OnboardingState) -> OnboardingState:
    """
    Passes images/logo to Vision Models (Qwen2.5-VL / Florence-2).
    """
    msg = "Initiating Vision Analysis on Brand Assets..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Vision Agent", msg, "running")
    
    # TODO: Implement Vision API/Local model call here to extract colors and layout
    await asyncio.sleep(1.0)
    
    state["vision_insights"] = {
        "primary_color": "#030303",
        "secondary_color": "#5A52FF",
        "font_family_heading": "Outfit",
        "font_family_body": "Inter"
    }
    return state

async def synthesis_and_persistence_node(state: OnboardingState) -> OnboardingState:
    """
    Synthesizes the scraped data using LLM and saves to Postgres & Qdrant.
    """
    msg = "Synthesizing brand profile and caching to PostgreSQL and Qdrant..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("System", msg, "running")
    
    # Gemini: the only provider with a configured key (OPENROUTER_API_KEY is empty).
    llm = GeminiProvider()
    prompt = f"Analyze the following scraped content and summarize the brand's tone, audience, and key value propositions in 3 sentences:\n\n{state['scraped_content']}"
    try:
        summary = await llm.generate_text(prompt, system_prompt="You are a brand strategist.")
    except LLMProviderError as e:
        # A fabricated brand summary would be embedded into the knowledge base and
        # silently poison every downstream agent, so fail instead.
        await manager.broadcast_agent_log("Brand Strategist", f"Brand analysis failed: {e}", "failed")
        raise

    state["typography"] = {"heading": state.get("vision_insights", {}).get("font_family_heading", "Inter")}
    state["color_palette"] = [state.get("vision_insights", {}).get("primary_color", "#030303")]
    state["brand_guidelines_summary"] = summary
    state["target_audience"] = "Growth marketers, startup founders."
    state["status"] = "completed"
    
    # Save to PostgreSQL
    from database import SessionLocal
    from models import Workspace, BrandProfile
    
    db = SessionLocal()
    try:
        ws = db.query(Workspace).filter(Workspace.id == state["workspace_id"]).first()
        if ws:
            ws.brand_voice = summary
            bp = db.query(BrandProfile).filter(BrandProfile.workspace_id == state["workspace_id"]).first()
            if not bp:
                bp = BrandProfile(workspace_id=state["workspace_id"])
                db.add(bp)
            bp.typography = state["typography"]
            bp.color_palette = state["color_palette"]
            bp.brand_guidelines_summary = summary
            bp.target_audience = state["target_audience"]
            bp.is_onboarded = True
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"PostgreSQL persist error: {e}")
    finally:
        db.close()
        
    # Persist the brand context to the knowledge base so generation can retrieve it.
    try:
        from database import qdrant_client
        from qdrant_client.models import PointStruct
        from core.embeddings import embed_passage, ensure_collection, COLLECTION_NAME
        import uuid

        ensure_collection(qdrant_client)

        content_to_embed = state.get("scraped_content", "")
        # Fallback to empty string if no content is scraped to avoid crash
        if not content_to_embed:
            content_to_embed = "Empty workspace context"

        # Re-indexing should REPLACE this workspace's knowledge, not pile new points on
        # top of stale ones (otherwise old "No content extracted" placeholders linger).
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        try:
            qdrant_client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=Filter(must=[FieldCondition(key="workspace_id", match=MatchValue(value=state["workspace_id"]))]),
            )
        except Exception as del_err:
            print(f"Qdrant cleanup (non-fatal): {del_err}")

        # Store one vector PER crawled page (better retrieval than one giant blob).
        crawled = [p for p in (state.get("scraped_pages") or []) if (p.get("content") or "").strip()]
        if crawled:
            points = [
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embed_passage(p["content"]),
                    payload={"workspace_id": state["workspace_id"], "content": p["content"],
                             "type": "onboarding_scrape", "source_url": p.get("url", "")},
                )
                for p in crawled
            ]
        else:
            points = [PointStruct(
                id=str(uuid.uuid4()),
                vector=embed_passage(content_to_embed),
                payload={"workspace_id": state["workspace_id"], "content": content_to_embed, "type": "onboarding_scrape"},
            )]
        qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
    except Exception as e:
        # Previously this only printed, so onboarding reported success while the
        # knowledge base stayed empty - and every later generation had no context.
        print(f"Qdrant persist error: {e}")
        await manager.broadcast_agent_log("System", f"Brand onboarding failed: could not save knowledge base ({e})", "failed")
        raise

    await manager.broadcast_agent_log("System", "Brand Onboarding Complete. Profile Cached.", "completed")
    return state

# --- Graph Compilation ---

workflow = StateGraph(OnboardingState)

workflow.add_node("brand_intelligence", brand_intelligence_node)
workflow.add_node("vision_analysis", vision_analysis_node)
workflow.add_node("synthesis_and_persistence", synthesis_and_persistence_node)

workflow.set_entry_point("brand_intelligence")
workflow.add_edge("brand_intelligence", "vision_analysis")
workflow.add_edge("vision_analysis", "synthesis_and_persistence")
workflow.add_edge("synthesis_and_persistence", END)

onboarding_graph = workflow.compile()

async def run_onboarding_pipeline(workspace_id: int, brand_url: str, brand_logo: str = None):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    initial_state = {
        "workspace_id": workspace_id,
        "brand_url": brand_url,
        "brand_logo": brand_logo,
        "guidelines_url": None,
        "scraped_content": "",
        "scraped_pages": [],
        "vision_insights": {},
        "typography": {},
        "color_palette": [],
        "brand_guidelines_summary": "",
        "target_audience": "",
        "logs": [],
        "status": "queued"
    }
    from core.agent_status import record_agent_task
    record_agent_task(workspace_id, "ONBOARDING", "RUNNING", f"Analyzing {brand_url}")
    try:
        result = await onboarding_graph.ainvoke(initial_state)
        record_agent_task(workspace_id, "ONBOARDING", "COMPLETED", "Brand profile & knowledge base built")
        return result
    except Exception as e:
        record_agent_task(workspace_id, "ONBOARDING", "FAILED", str(e)[:120])
        raise
