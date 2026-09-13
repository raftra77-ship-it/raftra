import asyncio
import json
from typing import TypedDict
from langgraph.graph import StateGraph, END
from core.providers.llm_providers import GeminiProvider, OpenRouterProvider
from core.websocket import manager, current_workspace_id
from database import SessionLocal
import models

class CampaignState(TypedDict):
    workspace_id: int
    prompt: str
    model: str
    cached_context: str
    objective: str
    budget: str
    audience: str
    placement: str
    geo_targeting_level: str
    geo_locations: list
    brief: dict          # channels, ad types, KPIs, keywords, Google copy, budget split
    campaign_spec: str
    logs: list

async def fetch_campaign_context(state: CampaignState) -> CampaignState:
    msg = f"Fetching historical campaign performance & ICP for workspace {state['workspace_id']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("System", msg, "running")
    
    # Full brand context: profile + Qdrant knowledge base (was profile-only before).
    from core.brand_context import get_brand_context
    brand_context = get_brand_context(state['workspace_id'], query="advertising campaign objective and audience")
    state["cached_context"] = brand_context
    await manager.broadcast_agent_log("System", "Brand context loaded into Campaign RAG.", "completed")
    return state

_CURRENCY = {"IN": "₹ (INR)", "US": "$ (USD)", "GB": "£ (GBP)", "AE": "AED", "SG": "S$ (SGD)"}

# What a strategist has to know to plan for one market. Qualitative only: no CPMs, no
# conversion rates, no spend benchmarks - the model is told elsewhere never to invent
# numbers, and a "typical Indian CPM" would be exactly that.
_MARKET_NOTES = {
    "IN": (
        "MARKET: INDIA. Plan for this market specifically, not a generic global one.\n"
        "- Currency is the Indian Rupee. Every budget, bid and price you mention is in ₹.\n"
        "  Do not convert to dollars or quote dollar figures.\n"
        "- Buyers are price- and value-sensitive and compare heavily before purchase, so\n"
        "  offers, EMI availability, exchange/return terms and delivery promises carry real\n"
        "  weight in ad copy.\n"
        "- Payments: UPI is the default online method; cash on delivery still matters for\n"
        "  first-time buyers. Mention COD/UPI only if the brand's own context supports it.\n"
        "- Language: English works for metros, but Hinglish and regional languages (Hindi,\n"
        "  Tamil, Telugu, Marathi, Bengali) often outperform for tier-2/tier-3 reach.\n"
        "  Recommend language variants when the audience spans beyond metros.\n"
        "- Geography: distinguish metro/tier-1 from tier-2 and tier-3 cities - intent,\n"
        "  price expectation and creative style differ sharply between them.\n"
        "- Seasonality: the festive calendar dominates retail demand (Diwali, Navratri,\n"
        "  Dussehra, Raksha Bandhan, Holi, Eid, Pongal/Onam regionally), alongside the big\n"
        "  ecommerce sale events and end-of-season sales. If the brief names a season or\n"
        "  date, plan around the relevant one.\n"
        "- Platforms: Meta (Instagram Reels especially) and YouTube dominate reach;\n"
        "  WhatsApp is the normal place a purchase conversation continues, so a\n"
        "  Click-to-WhatsApp destination is often stronger than a web form.\n"
        "- Mobile-first and data-conscious: assume vertical video, fast-loading pages and\n"
        "  copy that reads on a small screen.\n"
    ),
}


def _market_context(state: "CampaignState") -> str:
    """Market guidance for the strategist prompts.

    The prompts carried no geography at all, so recommendations came back generic and
    dollar-denominated even though this product defaults to India. The country comes from
    the campaign's own geo targeting when the user set it, else DEFAULT_MARKET_COUNTRY.
    """
    import os
    country = (os.getenv("DEFAULT_MARKET_COUNTRY") or "IN").strip().upper()
    locations = [str(x) for x in (state.get("geo_locations") or []) if str(x).strip()]

    parts = [_MARKET_NOTES.get(country, "MARKET: %s. Plan for this market specifically." % country)]
    parts.append("Currency for all figures: %s." % _CURRENCY.get(country, country))
    if locations:
        parts.append("The user targeted these locations (%s): %s. Tailor audience, language "
                     "and creative to them rather than to the country as a whole."
                     % (state.get("geo_targeting_level") or "Country-Level", ", ".join(locations[:12])))
    return "\n".join(parts)


def _fit(text: str, limit: int) -> str:
    """Trim to `limit` characters on a word boundary, keeping it readable.

    The prompt states these limits plainly, but the model still overshoots — and an ad
    one character over is rejected by the platform exactly like one fifty over. Cutting
    at the last space (and dropping trailing punctuation) beats both shipping copy the
    platform will refuse and truncating mid-word.
    """
    t = " ".join(str(text or "").split())
    if len(t) <= limit:
        return t
    cut = t[:limit]
    if " " in cut[int(limit * 0.6):]:      # only back off to a space if one is near the end
        cut = cut[:cut.rfind(" ")]
    return cut.rstrip(" ,;:-")


def _enforce_copy_limits(brief: dict) -> None:
    """Bring generated ad copy inside the platform limits, in place.

    Silent by design: it runs on every generation and the review screen shows the final
    counts. The publish-time validators stay the backstop for anything still oversized.
    """
    meta = brief.get("meta")
    if isinstance(meta, dict):
        if meta.get("primary_text"):
            meta["primary_text"] = _fit(meta["primary_text"], 125)
        if meta.get("headline"):
            meta["headline"] = _fit(meta["headline"], 40)

    google = brief.get("google")
    if isinstance(google, dict):
        for key, limit in (("headlines", 30), ("descriptions", 90)):
            items = google.get(key)
            if isinstance(items, list):
                google[key] = [f for f in (_fit(x, limit) for x in items) if f]


async def generate_json(llm, prompt, system, model):
    response = await llm.generate_text(prompt, system_prompt=system, model_name=model)
    return response.replace('```json', '').replace('```', '').strip()

async def objective_budget_node(state: CampaignState) -> CampaignState:
    await manager.broadcast_agent_log("Budget Agent", "Analyzing historical CPA/CPM and mapping objective...", "running")
    llm = GeminiProvider() if "gemini" in state["model"].lower() else OpenRouterProvider()
    
    market = _market_context(state)
    prompt = (f"User Request: {state['prompt']}\nContext: {state['cached_context']}\n\n{market}\n\n"
              "Output a JSON object with 'objective' (e.g. Traffic, Conversions) and "
              "'daily_budget' (number, in the market currency above).")
    resp = await generate_json(llm, prompt,
                               "You are a performance marketer determining campaign goals and "
                               "budgets for the market described in the prompt.", state["model"])
    
    try:
        data = json.loads(resp)
        state["objective"] = data.get("objective", "Conversions")
        state["budget"] = str(data.get("daily_budget", 50))
    except:
        state["objective"] = "Conversions"
        state["budget"] = "50"
    
    # Was a hardcoded "$", which mislabelled every budget in a product that runs on rupees.
    import os as _os
    _sym = {"IN": "₹", "US": "$", "GB": "£"}.get(
        (_os.getenv("DEFAULT_MARKET_COUNTRY") or "IN").strip().upper(), "")
    await manager.broadcast_agent_log(
        "Budget Agent",
        f"Set Objective to {state['objective']} at {_sym}{state['budget']}/day.", "completed")
    return state

async def audience_placement_node(state: CampaignState) -> CampaignState:
    await manager.broadcast_agent_log("Audience Agent", "Building ICP, Lookalikes, and Placements...", "running")
    llm = GeminiProvider() if "gemini" in state["model"].lower() else OpenRouterProvider()
    
    prompt = (f"User Request: {state['prompt']}\nContext: {state['cached_context']}\n\n"
              f"{_market_context(state)}\n\n"
              "Output a JSON object with 'audience_targeting' (string describing demographics "
              "and interests, using segments that are meaningful in this market - including "
              "city tiers and language where relevant) and 'placements' (array of strings "
              "like 'Instagram Reels', 'Facebook Feed').")
    resp = await generate_json(llm, prompt,
                               "You are an audience and media buyer specialist for the market "
                               "described in the prompt.", state["model"])
    
    try:
        data = json.loads(resp)
        state["audience"] = data.get("audience_targeting", "Broad Audience")
        state["placement"] = ", ".join(data.get("placements", ["Auto Placements"]))
    except:
        state["audience"] = "Broad (18-65+)"
        state["placement"] = "Facebook, Instagram"
        
    await manager.broadcast_agent_log("Audience Agent", "Audience and placements mapped successfully.", "completed")
    return state

_GOOGLE_TYPES = {"Search", "Display", "Performance Max", "Shopping", "Demand Gen", "Video"}


async def creative_brief_node(state: CampaignState) -> CampaignState:
    """The reasoning core, run as two concurrent LLM calls.

    This was one call producing the reasoned strategy, the Meta copy and the entire Google
    asset set together — several hundred tokens of JSON written in sequence, and at ~25s the
    single largest remaining cost in a ~41s strategy generation.

    The two halves are independent, which is the only thing that makes splitting them honest:
    strategy decides what to do and why; copy writes the words, from the objective, audience
    and brand that were all settled before this node ran. See agents/creative_nodes/
    _brief_halves.py for why the Google campaign type is not a dependency between them.
    """
    await manager.broadcast_agent_log("Strategy Agent", "Reasoning about platforms, budget split, Google campaign type and creative...", "running")
    llm = GeminiProvider() if "gemini" in state["model"].lower() else OpenRouterProvider()

    from . import _brief_halves as halves
    market = _market_context(state)
    strategy, copy = await asyncio.gather(
        halves.strategy_half(state, llm, generate_json, market),
        halves.copy_half(state, llm, generate_json, market),
    )

    # Merged with strategy last so that if both somehow return the same key, the reasoned
    # half wins — it is the one that decides campaign shape.
    brief: dict = {}
    brief.update(copy or {})
    brief.update(strategy or {})

    _enforce_copy_limits(brief)

    rec = brief.get("recommendations") or {}
    google = brief.get("google") or {}
    meta = brief.get("meta") or {}

    # Normalise the Google campaign type to one we support.
    gtype = ((rec.get("google_campaign_type") or {}).get("value") or "Search").strip().title()
    if gtype not in _GOOGLE_TYPES:
        gtype = "Performance Max" if gtype.lower().startswith("perf") else "Search"
    rec.setdefault("google_campaign_type", {})
    rec["google_campaign_type"]["value"] = gtype

    # Enforced here rather than asked of the model. The copy half writes every asset array
    # because it does not know the type; this empties the ones this type does not use, which
    # is also stricter than the prompt line it replaces.
    google = halves.apply_type_assets(google, gtype)

    # Budget split from the reasoned allocation (fall back to 70/30).
    ba = rec.get("budget_allocation") or {}
    try:
        meta_pct = int(ba.get("meta_pct", 70))
    except (TypeError, ValueError):
        meta_pct = 70
    meta_pct = max(0, min(100, meta_pct))

    # Back-compat fields the existing setup screens already read.
    brief["channels"] = brief.get("channels") or ["Meta Ads", "Google Ads"]
    brief["ad_types"] = brief.get("ad_types") or ["Image Ads", "Carousel Ads"]
    brief["kpis"] = brief.get("kpis") or ["CTR > 2%", "CPA within target"]
    brief["top_keywords"] = google.get("keywords") or []
    brief["google_headlines"] = google.get("headlines") or []
    brief["google_descriptions"] = google.get("descriptions") or []
    brief.setdefault("duration_days", 15)
    brief["meta_split_pct"] = meta_pct
    brief["recommendations"] = rec
    brief["google"] = google
    brief["google_campaign_type"] = gtype
    brief["meta"] = meta

    state["brief"] = brief
    await manager.broadcast_agent_log(
        "Strategy Agent",
        f"Reasoned strategy ready — Google type: {gtype}, budget split {meta_pct}/{100 - meta_pct} Meta/Google, "
        f"{len(brief['google_headlines'])} headlines.", "completed")
    return state


def _to_float(v, default=0.0) -> float:
    try:
        return float(str(v).replace(",", "").replace("₹", "").strip())
    except Exception:
        return default


async def supervisor_spec_node(state: CampaignState) -> CampaignState:
    await manager.broadcast_agent_log("Supervisor", "Merging node outputs into final Campaign JSON Spec...", "running")

    import datetime as _dt
    brief = state.get("brief") or {}

    # Budget split across platforms, derived from the total the user asked for.
    total = _to_float(brief.get("total_budget"), 0.0)
    if total <= 0:
        total = _to_float(state["budget"], 0.0) * float(brief.get("duration_days", 15) or 15)
    meta_pct = int(brief.get("meta_split_pct", 70) or 70)
    meta_pct = max(0, min(100, meta_pct))
    google_pct = 100 - meta_pct
    meta_amt = round(total * meta_pct / 100.0, 2)
    google_amt = round(total - meta_amt, 2)

    days = int(brief.get("duration_days", 15) or 15)
    start = _dt.date.today()
    end = start + _dt.timedelta(days=days)

    spec = {
        "campaign_name": f"AI Campaign - {state['objective']}",
        "objective": state["objective"],
        "daily_budget": state["budget"],
        "audience": state["audience"],
        "placements": state["placement"],
        # Passed through verbatim from the user's form input - never re-derived by an LLM
        # from prose, so the exact geography picked can't drift during strategy generation.
        "geo_targeting": {
            "level": state.get("geo_targeting_level") or "Country-Level",
            "locations": state.get("geo_locations") or [],
        },
        # ---- richer plan used by the setup screens ----
        "total_budget": total,
        "budget_split": {
            "meta": {"pct": meta_pct, "amount": meta_amt},
            "google": {"pct": google_pct, "amount": google_amt},
        },
        "channels": brief.get("channels"),
        "ad_types": brief.get("ad_types"),
        "kpis": brief.get("kpis"),
        "top_keywords": brief.get("top_keywords"),
        "google_headlines": brief.get("google_headlines"),
        "google_descriptions": brief.get("google_descriptions"),
        "duration_days": days,
        "duration_label": f"{start.strftime('%d %b')} - {end.strftime('%d %b %Y')} ({days} Days)",
        # ---- reasoned strategy (the "Why AI Recommended This" + dynamic Google type) ----
        "recommendations": brief.get("recommendations") or {},
        "google_campaign_type": brief.get("google_campaign_type") or "Search",
        "google": brief.get("google") or {},
        "meta": brief.get("meta") or {},
        "status": "pending_review",
    }

    state["campaign_spec"] = json.dumps(spec)
    await manager.broadcast_agent_log("Supervisor", "Campaign Spec Ready for Human Review.", "completed")
    return state

async def objective_and_audience_node(state: CampaignState) -> CampaignState:
    """Runs the budget and audience LLM calls concurrently.

    These two are independent - audience_placement_node reads only 'prompt' and
    'cached_context', never the objective/budget the other one produces - so running
    them in sequence just added a whole extra LLM round-trip to the user's wait.
    They write disjoint keys of the same state dict, so sharing it is safe.
    """
    await asyncio.gather(
        objective_budget_node(state),
        audience_placement_node(state),
    )
    return state


workflow = StateGraph(CampaignState)
workflow.add_node("context", fetch_campaign_context)
workflow.add_node("plan", objective_and_audience_node)
workflow.add_node("brief", creative_brief_node)
workflow.add_node("supervisor", supervisor_spec_node)

workflow.set_entry_point("context")
workflow.add_edge("context", "plan")
workflow.add_edge("plan", "brief")
workflow.add_edge("brief", "supervisor")
workflow.add_edge("supervisor", END)

campaign_graph = workflow.compile()

async def run_campaign_planning_task(workspace_id: int, prompt: str, model: str = "gemini-2.5-flash",
                                     geo_targeting_level: str = None, geo_locations: list = None,
                                     ad_headline: str = None):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    initial_state = {
        "workspace_id": workspace_id,
        "prompt": prompt,
        "model": model,
        "cached_context": "",
        "objective": "",
        "budget": "",
        "audience": "",
        "placement": "",
        "geo_targeting_level": geo_targeting_level or "",
        "geo_locations": geo_locations or [],
        "brief": {},
        "campaign_spec": "",
        "logs": []
    }
    
    await manager.broadcast_agent_log("System", "Initializing AI Campaign Manager Workflow...", "queued")

    from core.agent_status import record_agent_task
    record_agent_task(workspace_id, "CAMPAIGN", "RUNNING", prompt[:80])

    try:
        result = await campaign_graph.ainvoke(initial_state)
        spec = json.loads(result["campaign_spec"])

        # The strategy is saved and announced BEFORE the image is generated, and that order
        # matters more than it looks.
        #
        # The image used to be generated first, with the campaign row written afterwards — so
        # the row appeared only once the picture was done. Campaign Manager polls
        # /campaigns every 3s for a new id and gives up after 20 tries, i.e. 60 seconds. The
        # whole task measured 112s, so the poll ALWAYS expired before the row existed and the
        # user was told "Taking longer than expected" for a campaign that then quietly
        # appeared minutes later. That is the "strategy is not generating" report.
        #
        # Switching the provider to hf_flux made it worse, not better: Pollinations returned a
        # lazy URL in milliseconds (the picture is rendered later, by the browser, when it
        # loads the link), while a real generator spends 30-60s producing actual pixels. The
        # fix is not a faster image — it is refusing to let the image gate the strategy.
        campaign_id = 0
        try:
            with SessionLocal() as db:
                camp = models.Campaign(
                    workspace_id=workspace_id,
                    platform="Meta / Google",
                    name=spec.get("campaign_name", "AI Campaign"),
                    objective=spec.get("objective", ""),
                    budget=float(spec.get("daily_budget", 0) or 0),
                    status="PENDING_REVIEW",
                    metrics=dict(spec),
                )
                db.add(camp)
                db.commit()
                db.refresh(camp)
                campaign_id = camp.id
        except Exception as e:
            print(f"Failed to save Campaign: {e}")

        # Announced with image_url None: the strategy is genuinely ready and the creative is
        # still rendering. The UI shows the plan now and fills the image in when it lands.
        await manager.broadcast(json.dumps({
            "type": "campaign_spec_generated",
            "campaign_id": campaign_id,
            "spec": result["campaign_spec"],
            "image_url": None,
        }))
        record_agent_task(workspace_id, "CAMPAIGN", "RUNNING",
                          f"Strategy ready — generating the ad image for "
                          f"{spec.get('campaign_name', '')[:40]}")

        # Generated through the SAME pipeline the Creative Studio uses, rather than a second,
        # weaker one. This called FluxSchnellProvider directly — Pollinations, the keyless
        # provider the router treats as the floor — while the Studio asks
        # router_decision_engine, which on this deployment returns hf_flux. Measured on one
        # prompt: 768x768 / 52KB against 1024x1024 / 846KB.
        #
        # Three things were missing besides the provider. The prompt was hand-assembled here
        # instead of built by core.creative.optimizer, so it carried none of the composition
        # and lighting structure the providers are tuned for. No negative prompt was sent at
        # all, so nothing suppressed the watermarks, extra limbs and garbled lettering it
        # exists to suppress. And brand context never reached it, so the creative described a
        # generic product rather than this brand's. service.plan() supplies all three.
        image_url = None
        try:
            from core.creative.service import service as creative_service, _image_provider
            from core.creative import optimizer as creative_optimizer
            from agents.creative_nodes.router import router_decision_engine

            # A VISUAL brief, assembled from the strategy — not the campaign form.
            #
            # This was `prompt[:200]`, a truncation of the string the form builds. For a real
            # request that came out as "Create an ad campaign. Theme/focus: Diwali Festive
            # Sale. Objective: Conversions. Total budget: 40000. Audience: Women 18-35, Tier 1
            # & Tier 2 Cities, Interested in Festive Sho" — cut mid-word, and mostly budget,
            # funnel and UTM values. None of that describes a picture, so the analyzer had
            # almost nothing to work with and the campaign's own creative direction, which the
            # strategy graph had just spent four LLM calls producing, never reached the image
            # at all.
            theme = (spec.get("campaign_name") or "").replace("AI Campaign - ", "").strip()
            creative_note = ((spec.get("recommendations") or {}).get("creative") or "")
            brief_bits = [
                f"Advertising creative for {theme}" if theme else "Advertising creative",
                f"{spec.get('objective', '')} campaign" if spec.get("objective") else "",
                f"aimed at {str(spec.get('audience') or '')[:200]}" if spec.get("audience") else "",
                str(creative_note)[:300],
            ]
            brief = ". ".join(b for b in brief_bits if b) + "."

            # Meta feed: the placement these campaigns actually publish to, so the aspect
            # ratio comes from platforms.py instead of being hardcoded 1:1.
            cspec = await creative_service.plan(
                workspace_id=workspace_id, prompt=brief, media_type="image",
                platform="facebook", placement="feed")

            # Words on the image, when the user asked for them.
            #
            # The optimizer has always supported this — it renders `with the words "..."
            # rendered clearly` when spec.text_in_image is set, and otherwise pushes "text,
            # words, letters, captions, logos" into the NEGATIVE prompt. Campaign Manager
            # could never reach the first branch: nothing in its brief mentioned text, so the
            # analyzer left the flag false and every campaign creative was actively instructed
            # not to contain lettering. Setting it here from the form field is the difference
            # between suppressing text and rendering it.
            wants_text = bool((ad_headline or "").strip())
            if wants_text:
                cspec.text_in_image = True
                cspec.headline = ad_headline.strip()[:80]

            prompts = creative_optimizer.build_prompts(cspec)
            # Typography routing: diffusion models differ enormously at rendering legible
            # words, and the router already prefers the strongest one when the request says so.
            # It reads the request text, which never mentioned text before — so a request for a
            # headline on the image was routed as if it were a plain photograph.
            route_text = brief + (" text-heavy poster with typography" if wants_text else "")
            provider_name = router_decision_engine("conversion", route_text)["image_provider"]
            async def _gen(name: str) -> str:
                return await _image_provider(name).generate_image(
                    prompts["image_prompt"],
                    aspect_ratio=prompts["aspect_ratio"],
                    negative_prompt=prompts["negative_prompt"],
                )

            try:
                image_url = await _gen(provider_name)
                print(f"[campaign] creative generated via {provider_name} "
                      f"at {prompts['aspect_ratio']}")
            except Exception as primary_err:
                # The best provider can be configured and still refuse. A backfill of 34
                # campaigns hit "402: You have depleted your monthly included credits" from
                # Hugging Face partway through — the token is present, so the router keeps
                # choosing it, and every generation after that point produced no image at all.
                # A keyless retry is worse-looking than the first choice and far better than a
                # campaign with no creative, which is the only other outcome available here.
                # generation_graph.py has always done this; this path had no fallback.
                if provider_name == "flux_schnell":
                    raise
                print(f"[campaign] {provider_name} failed ({str(primary_err)[:120]}); "
                      f"retrying on the keyless provider.")
                image_url = await _gen("flux_schnell")
                provider_name = "flux_schnell"
                print(f"[campaign] creative generated via {provider_name} (fallback) "
                      f"at {prompts['aspect_ratio']}")

            # Store the bytes and keep a URL — never the data: URI itself.
            #
            # GET /campaigns returns each row's `metrics` wholesale, so a 1.5MB inline image
            # is 1.5MB added to every campaign-list response, for every campaign, forever.
            # Three test rows had already taken that payload to 4.5MB. core/creative solved
            # the same problem for ad assets by handing back a URL instead of the bytes; this
            # uses the same storage helper, so campaign creatives live beside uploaded ones
            # and the list stays small.
            if image_url and image_url.startswith("data:"):
                try:
                    import base64 as _b64
                    header, _, b64 = image_url.partition(",")
                    content_type = header.split(";")[0].replace("data:", "") or "image/png"
                    raw = _b64.b64decode(b64)
                    from storage import store_bytes
                    image_url = store_bytes(
                        raw, f"campaign-creative.{content_type.split('/')[-1]}",
                        content_type, workspace_id=workspace_id, category="creatives")
                    print(f"[campaign] creative stored ({len(raw) // 1024}KB) at {image_url[:70]}")
                except Exception as e:
                    # Keeping the data URI is worse than a URL but far better than no image;
                    # the row is simply heavier until the next generation.
                    print(f"Could not store campaign creative, keeping inline: {e}")
        except Exception as e:
            print(f"Campaign image generation failed: {e}")

        # Attach the creative to the row that already exists. A failure here costs the image
        # only — the strategy is already saved and on screen, which is the whole point of the
        # ordering above.
        if image_url and campaign_id:
            try:
                with SessionLocal() as db:
                    camp = db.query(models.Campaign).filter(
                        models.Campaign.id == campaign_id).first()
                    if camp:
                        m = dict(camp.metrics or {})
                        m["image_url"] = image_url
                        camp.metrics = m
                        db.commit()
            except Exception as e:
                print(f"Failed to attach campaign image: {e}")

        await manager.broadcast(json.dumps({
            "type": "campaign_image_ready",
            "campaign_id": campaign_id,
            "image_url": image_url,
        }))
        record_agent_task(workspace_id, "CAMPAIGN", "COMPLETED",
                          f"Campaign plan ready: {spec.get('campaign_name', '')[:60]}")
    except Exception as e:
        await manager.broadcast_agent_log("Campaign Agent", f"Campaign generation failed: {e}", "failed")
        record_agent_task(workspace_id, "CAMPAIGN", "FAILED", str(e)[:120])
