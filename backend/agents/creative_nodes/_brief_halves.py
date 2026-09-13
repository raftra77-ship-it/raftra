"""The creative brief, split into two independent LLM calls.

The brief was one call producing everything: the reasoned strategy, the Meta ad copy and the
whole Google asset set. It measured ~25s of a ~41s strategy generation — the single largest
remaining cost — because one model was writing several hundred tokens of JSON in sequence.

The two halves here are genuinely independent, which is the only reason they can run at once:

  * `strategy_half` decides what to do and why — objective, platforms, budget split, Google
    campaign type, KPIs. Reasoning, no copy.
  * `copy_half` writes the ad copy for both platforms. It needs the objective, the audience
    and the brand, all of which are settled before this node runs. It does NOT need the
    campaign type, because the type does not change how a headline is written — it only
    decides which asset arrays are kept, and that filtering happens in code after both
    calls return.

That last point is what made the split possible. The original prompt said "Only fill the
asset arrays the chosen type actually uses; leave the rest as []", which made the copy
depend on a decision taken in the same call. Moving that rule into GOOGLE_TYPE_ASSETS is
also stricter than asking for it: a model that fills image_ideas for a Search campaign no
longer gets to.
"""
import json

# Which Google asset arrays each campaign type actually uses. A fixed property of Google's
# campaign types, not a judgement, so it belongs in code rather than in a prompt.
GOOGLE_TYPE_ASSETS = {
    "Search":          {"headlines", "descriptions", "keywords", "extensions"},
    "Display":         {"headlines", "descriptions", "image_ideas"},
    "Performance Max": {"headlines", "descriptions", "image_ideas", "video_ideas", "audience_signals"},
    "Shopping":        {"headlines", "descriptions"},
    "Demand Gen":      {"headlines", "descriptions", "image_ideas", "audience_signals"},
    "Video":           {"headlines", "descriptions", "video_ideas"},
}

GOOGLE_ASSET_KEYS = ("headlines", "descriptions", "keywords", "extensions",
                     "image_ideas", "video_ideas", "audience_signals")

_STRATEGY_SYSTEM = (
    "You are a senior digital-marketing strategist. Apply real, current best practices for "
    "Meta Ads and Google Ads. EVERY recommendation MUST include a short, plain-language reason "
    "(the WHY) tied to the business, goal, audience, budget or search intent. Never invent "
    "statistics or facts; if unsure, explain the reasoning rather than fabricating numbers.\n\n"
    "Choose the Google campaign TYPE from goal + intent:\n"
    "- Search: people actively search for this product/service (high intent; leads/sales).\n"
    "- Display: awareness/retargeting across sites (visual, lower intent).\n"
    "- Performance Max: goal-based automation across all Google inventory (ecommerce/conversions).\n"
    "- Shopping: retail products with a product feed.\n"
    "- Demand Gen: social-style discovery on YouTube/Discover/Gmail.\n"
    "- Video: awareness/consideration on YouTube.\n\n"
    "Recommendations must be specific to the market described in the prompt - its currency, "
    "buying behaviour, languages, city tiers, seasonal calendar and the platforms people there "
    "actually use. A recommendation that would read identically for any country is not specific "
    "enough. Still never invent statistics: ground the WHY in the market's characteristics and "
    "the brand's own context, not in made-up benchmark numbers."
)

_STRATEGY_SHAPE = (
    "Return ONLY a JSON object with EXACTLY these keys:\n"
    "{\n"
    '  "recommendations": {\n'
    '    "objective": {"value": "...", "reason": "..."},\n'
    '    "platforms": [{"value": "Meta Ads", "reason": "..."}, {"value": "Google Ads", "reason": "..."}],\n'
    '    "budget_allocation": {"meta_pct": 60, "google_pct": 40, "reason": "..."},\n'
    '    "google_campaign_type": {"value": "Search", "reason": "..."},\n'
    '    "audience": {"value": "...", "reason": "..."},\n'
    '    "creative": {"value": "...", "reason": "..."},\n'
    '    "cta": {"value": "Shop Now", "reason": "..."},\n'
    '    "optimization_goal": {"value": "...", "reason": "..."}\n'
    "  },\n"
    '  "kpis": ["2-4 measurable targets, e.g. CTR > 2%"],\n'
    '  "channels": ["Meta Ads","Google Ads"],\n'
    '  "ad_types": ["Image Ads","Carousel Ads"],\n'
    '  "duration_days": 15,\n'
    '  "total_budget": <total budget number from the request>\n'
    "}"
)

_COPY_SYSTEM = (
    "You are a senior performance copywriter for Meta Ads and Google Ads. Write copy that sells "
    "to the stated audience in their market, using their language conventions. Never invent "
    "statistics, prices, discounts, awards or claims that are not in the brief.\n\n"
    "CHARACTER LIMITS ARE HARD PLATFORM RULES, NOT STYLE ADVICE. Google and Meta reject any ad "
    "whose copy exceeds them, so a campaign that breaks even one of these cannot be published "
    "at all:\n"
    "  - google.headlines    : 30 characters MAX, each\n"
    "  - google.descriptions : 90 characters MAX, each\n"
    "  - meta.headline       : 40 characters MAX\n"
    "  - meta.primary_text   : 125 characters MAX\n"
    "Count the characters of each one before answering, spaces and punctuation included, and "
    "rewrite anything over. Shorter is always fine; over is never."
)

_COPY_SHAPE = (
    "Return ONLY a JSON object with EXACTLY these keys:\n"
    "{\n"
    '  "meta": {"primary_text": "... (ONE sentence, HARD LIMIT 125 characters)",'
    ' "headline": "... (HARD LIMIT 40 characters)", "cta": "...",'
    ' "placements": ["Instagram Reels","Facebook Feed"]},\n'
    '  "google": {\n'
    '    "headlines": ["... 8-15 items, HARD LIMIT 30 characters each"],\n'
    '    "descriptions": ["... 4 items, HARD LIMIT 90 characters each"],\n'
    '    "keywords": ["... 5-15 search phrases a buyer would actually type"],\n'
    '    "extensions": ["Sitelink: ...","Callout: ..."],\n'
    '    "image_ideas": ["short image descriptions"],\n'
    '    "video_ideas": ["short video concepts"],\n'
    '    "audience_signals": ["..."],\n'
    '    "cta": "..."\n'
    "  }\n"
    "}"
)


def _shared_context(state, market_context: str) -> str:
    """Everything both halves need. Identical by construction, so the two calls cannot end up
    reasoning from different versions of the brief."""
    return (
        "Campaign brief from the user (may include business type, industry, product, goal, "
        "budget, audience, location, season, website, landing page):\n"
        f"{state['prompt']}\n\n"
        f"Business/brand context:\n{state['cached_context']}\n\n"
        f"{market_context}\n\n"
        f"Chosen objective: {state['objective']}\nAudience: {state['audience']}\n\n"
    )


async def _run(generate_json, llm, prompt, system, model, label):
    """One half. Returns {} on any failure rather than raising: losing the copy should cost
    the copy, not the whole campaign — the caller fills the gaps from its own defaults."""
    try:
        raw = await generate_json(llm, prompt, system, model)
        return json.loads(raw) or {}
    except Exception as e:
        print(f"[campaign] {label} half failed: {e}")
        return {}


async def strategy_half(state, llm, generate_json, market_context: str) -> dict:
    return await _run(generate_json, llm,
                      _shared_context(state, market_context) + _STRATEGY_SHAPE,
                      _STRATEGY_SYSTEM, state["model"], "strategy")


async def copy_half(state, llm, generate_json, market_context: str) -> dict:
    return await _run(generate_json, llm,
                      _shared_context(state, market_context) + _COPY_SHAPE,
                      _COPY_SYSTEM, state["model"], "copy")


def apply_type_assets(google: dict, gtype: str) -> dict:
    """Blank the Google asset arrays this campaign type does not use.

    Deterministic replacement for the prompt line that used to ask the model for this. Keys
    are emptied rather than removed so the setup screens, which read them unconditionally,
    keep seeing a list.
    """
    allowed = GOOGLE_TYPE_ASSETS.get(gtype, GOOGLE_TYPE_ASSETS["Search"])
    for key in GOOGLE_ASSET_KEYS:
        if key not in allowed:
            google[key] = []
    return google
