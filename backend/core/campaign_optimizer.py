"""
Campaign optimization engine.

Given REAL per-campaign insights pulled from the Meta Marketing API, this produces the
"what's working / what's not / keep / switch / kill" notifications the user asked for.

Design rules (kept honest on purpose):
  - Every recommendation is derived from measured numbers that are echoed back as `evidence`.
    Nothing is invented. If there isn't enough spend to judge a campaign, we say exactly that
    instead of guessing.
  - Each recommendation carries an `action` describing the ONE concrete change the UI can
    execute after a confirmation click (pause a campaign, or set a new daily budget). Advisory
    items carry action.kind == "none".
  - Thresholds are heuristics with sensible defaults and can be overridden per call. They are
    not presented as ground truth — the message always states the number and the target.
"""
from typing import List, Dict, Any


DEFAULTS = {
    "target_roas": 2.0,     # break-even-plus; what a "good" ROAS means for this account
    "min_spend": 500.0,     # below this we don't have enough signal to judge (major currency units)
    "ctr_low": 1.0,         # % — below this, the creative isn't earning the click
    "freq_high": 3.0,       # average times each person saw the ad before we call it saturation
    "scale_step": 0.25,     # +25% budget when scaling a winner
    "trim_step": 0.30,      # -30% budget when reining in an underperformer
}


def _money(v: float) -> str:
    try:
        return f"₹{float(v):,.0f}"
    except (ValueError, TypeError):
        return f"₹{v}"


def _retail_window(today=None) -> List[dict]:
    """Indian retail dates whose campaign lead time has ALREADY started — i.e. creative for
    them should be live right now.

    The calendar (core.retail_calendar) was reaching the creative and scheduling agents but
    not this engine, so budget advice was blind to the single biggest driver of Indian ad
    performance: where you are standing relative to the festive run-up. Advising a brand to
    pause a campaign eight days before Dhanteras is very different advice from the same call
    in a flat week, and the engine could not tell the two apart.

    Failure here is non-fatal: no window simply means no timing note is added.
    """
    try:
        from core.retail_calendar import upcoming
        return [e for e in upcoming(within_days=45, today=today)
                if e.get("planning_urgency") in ("overdue", "start_now")]
    except Exception as e:      # calendar exhausted for the year, import problem, bad date
        print(f"[optimizer] retail calendar unavailable, continuing without it: {e}")
        return []


def _timing_note(window: List[dict], kind: str) -> str:
    """A factual, dated sentence about the nearest live retail window.

    Deliberately states only what is known — the festival, its date, how far away it is —
    and what the proposed action would mean for that window. It makes no claim about how
    this account will perform, because nothing here has measured that.
    """
    if not window:
        return ""
    e = min(window, key=lambda x: x["days_away"])
    head = f" Timing: {e['name']} ({e['date']}, {e['category']}) is {e['days_away']} days away"
    if kind == "pause":
        return head + " and its buying window is already open — pausing now also takes this campaign out of that run-up."
    if kind == "trim":
        return head + " and its buying window is already open — consider trimming after the date rather than during the run-up."
    if kind == "scale":
        return head + " — scaling now places the extra budget inside its buying window."
    return head + "."


def _rec(campaign, signal, severity, title, detail, evidence, action, expected):
    return {
        "campaign_id": campaign.get("campaign_id"),
        "campaign_name": campaign.get("campaign_name") or "Untitled campaign",
        "signal": signal,          # working | scaling | underperforming | wasting | learning
        "severity": severity,      # good | warn | critical | neutral
        "title": title,
        "detail": detail,
        "evidence": evidence,
        "action": action,          # {"kind": "pause"|"scale_budget"|"none", ...}
        "expected": expected,
    }


def rule_breaches(m: dict, rules: dict, min_spend: float = None) -> List[str]:
    """Which of a campaign's OWN Optimization Rules its live numbers break, in plain words.

    One definition with two callers: analyze() turns a breach into a critical
    recommendation, and core.rule_enforcer pauses the campaign on exactly the same
    condition. Keeping it in one place is what stops the screen and the automatic action
    from ever disagreeing about whether a rule was broken.

    Rules come from metrics["optimization"] as the UI saves them: cpa_limit,
    frequency_limit, auto_kill. Below min_spend nothing is judged — acting on two clicks of
    delivery would kill ads on noise.
    """
    if not rules:
        return []
    spend = float(m.get("spend", 0) or 0)
    floor = DEFAULTS["min_spend"] if min_spend is None else float(min_spend)
    if spend < floor:
        return []
    out: List[str] = []
    purchases = int(m.get("purchases", 0) or 0)
    cpa_limit = rules.get("cpa_limit")
    if cpa_limit and purchases > 0:
        cpa = spend / purchases
        if cpa > float(cpa_limit):
            out.append(f"cost per purchase is {_money(cpa)} against your {_money(float(cpa_limit))} limit")
    freq_limit = rules.get("frequency_limit")
    freq = float(m.get("frequency", 0) or 0)
    if freq_limit and freq > float(freq_limit):
        out.append(f"frequency is {freq:.1f} against your {float(freq_limit):.1f} limit")
    return out


def analyze(insights: Dict[str, dict],
            current_budgets: Dict[str, float] = None,
            per_campaign: Dict[str, dict] = None,
            **overrides) -> Dict[str, Any]:
    """insights: {campaign_id: {metrics...}} from meta_ads.fetch_insights.
       current_budgets: {campaign_id: daily_budget} so scale actions can suggest a real number.
       per_campaign: {campaign_id: optimization rules} — the limits the user set on that
         campaign. Previously nothing read those rules at all, so the feed judged every
         campaign by the account-wide defaults and a user's own CPA limit changed nothing.
       Returns {summary, recommendations[]}."""
    cfg = {**DEFAULTS, **{k: v for k, v in overrides.items() if v is not None}}
    per_campaign = per_campaign or {}
    current_budgets = current_budgets or {}
    target = cfg["target_roas"]
    recs: List[dict] = []
    # Where this account is standing in the Indian retail year. Computed once per call.
    window = _retail_window()

    total_spend = 0.0
    total_purchase_value = 0.0
    working = under = wasting = 0

    for cid, m in insights.items():
        spend = float(m.get("spend", 0) or 0)
        roas = float(m.get("roas", 0) or 0)
        ctr = float(m.get("ctr", 0) or 0)
        freq = float(m.get("frequency", 0) or 0)
        purchases = int(m.get("purchases", 0) or 0)
        total_spend += spend
        total_purchase_value += roas * spend

        cur_budget = current_budgets.get(cid)

        # The user's own limits come first: a campaign breaking a rule they set themselves
        # should not be described as "still gathering data" or "working well" further down.
        breaches = rule_breaches(m, per_campaign.get(cid) or {}, cfg["min_spend"])
        if breaches:
            recs.append(_rec(
                m, "rule_breach", "critical",
                "Your own rule says stop this",
                "This campaign breaks a limit you set in Campaign Optimization Rules: "
                + "; ".join(breaches) + "."
                + _timing_note(window, "pause"),
                {"spend": spend, "roas": roas, "frequency": freq, "purchases": purchases},
                {"kind": "pause", "campaign_id": cid, "label": "Pause (breaks your rule)"},
                "Stops spend that breaks a limit you set.",
            ))
            wasting += 1
            continue

        # Not enough spend to judge yet — say so, don't guess.
        if spend < cfg["min_spend"]:
            recs.append(_rec(
                m, "learning", "neutral",
                "Still gathering data",
                f"Only {_money(spend)} spent so far (need ≥ {_money(cfg['min_spend'])} to judge reliably). "
                f"Let it run before changing anything.",
                {"spend": spend, "roas": roas, "purchases": purchases},
                {"kind": "none"},
                "Decision deferred until there's enough signal.",
            ))
            continue

        # WINNER — scale up.
        if roas >= target * 1.3:
            new_budget = round(cur_budget * (1 + cfg["scale_step"]), 2) if cur_budget else None
            recs.append(_rec(
                m, "scaling", "good",
                "Working well — scale this up",
                f"ROAS {roas:.2f}× is well above your {target:.1f}× target on {_money(spend)} spend"
                + (f" ({purchases} purchases)." if purchases else ".")
                + (f" Raising daily budget by {int(cfg['scale_step']*100)}% "
                   f"({_money(cur_budget)} → {_money(new_budget)}) presses the advantage."
                   if new_budget else " Consider raising its budget.")
                + _timing_note(window, "scale"),
                {"roas": roas, "spend": spend, "purchases": purchases},
                ({"kind": "scale_budget", "campaign_id": cid, "new_daily_budget": new_budget,
                  "label": f"Scale budget +{int(cfg['scale_step']*100)}%"}
                 if new_budget else {"kind": "none"}),
                "More volume at a proven ROAS.",
            ))
            working += 1
            continue

        # MEETING TARGET — keep going.
        if roas >= target:
            recs.append(_rec(
                m, "working", "good",
                "Keep this strategy going",
                f"ROAS {roas:.2f}× is at or above your {target:.1f}× target on {_money(spend)} spend. "
                f"No change needed — leave it running.",
                {"roas": roas, "spend": spend, "purchases": purchases},
                {"kind": "none"},
                "Steady, profitable delivery.",
            ))
            working += 1
            continue

        # WASTING — kill it.
        if roas < target * 0.5 or (purchases == 0 and spend >= cfg["min_spend"] * 2):
            recs.append(_rec(
                m, "wasting", "critical",
                "Kill this — it's wasting spend",
                (f"ROAS is only {roas:.2f}× against a {target:.1f}× target after {_money(spend)} spent"
                 + (f" with {purchases} purchases." if purchases else " with no purchases.")
                 + " Pausing it stops the bleed and frees budget for the winners."
                 + _timing_note(window, "pause")),
                {"roas": roas, "spend": spend, "purchases": purchases},
                {"kind": "pause", "campaign_id": cid, "label": "Kill ad (pause)"},
                f"Stops ~{_money(spend)}/period of unprofitable spend.",
            ))
            wasting += 1
            continue

        # UNDERPERFORMING — switch strategy. Name the specific lever from the data.
        if ctr < cfg["ctr_low"]:
            lever = (f"CTR is {ctr:.2f}% (below {cfg['ctr_low']:.1f}%) — the creative isn't earning the "
                     f"click. Refresh the creative (new hook/visual) to lift CTR and ROAS.")
        elif freq >= cfg["freq_high"]:
            lever = (f"Frequency is {freq:.1f} — the same people are seeing it too often (fatigue). "
                     f"Broaden the audience or refresh the creative to recover ROAS.")
        else:
            lever = ("Delivery is fine but conversion economics are weak. Tighten targeting to your "
                     "best segment and trim budget until ROAS recovers.")
        new_budget = round(cur_budget * (1 - cfg["trim_step"]), 2) if cur_budget else None
        recs.append(_rec(
            m, "underperforming", "warn",
            "Switch this strategy",
            f"ROAS {roas:.2f}× is below your {target:.1f}× target on {_money(spend)} spend. {lever}"
            + _timing_note(window, "trim"),
            {"roas": roas, "spend": spend, "ctr": ctr, "frequency": freq, "purchases": purchases},
            ({"kind": "scale_budget", "campaign_id": cid, "new_daily_budget": new_budget,
              "label": f"Trim budget -{int(cfg['trim_step']*100)}%"}
             if new_budget else {"kind": "none"}),
            "Better ROAS by fixing the weak lever above.",
        ))
        under += 1

    # Order the feed: critical (kill) → warnings (switch) → good (scale/keep) → neutral (learning).
    order = {"critical": 0, "warn": 1, "good": 2, "neutral": 3}
    recs.sort(key=lambda r: (order.get(r["severity"], 9), -float(r["evidence"].get("spend", 0))))

    blended_roas = round(total_purchase_value / total_spend, 2) if total_spend > 0 else 0.0
    return {
        "summary": {
            "campaigns_analyzed": len(insights),
            "total_spend": round(total_spend, 2),
            "blended_roas": blended_roas,
            "target_roas": target,
            "working": working,
            "underperforming": under,
            "wasting": wasting,
            # Indian retail dates whose lead time is already running, nearest first, so the
            # UI can show what the timing notes above are referring to. Empty in a flat week.
            "retail_window": [
                {"name": e["name"], "date": e["date"], "category": e["category"],
                 "days_away": e["days_away"], "campaign_start": e["campaign_start"]}
                for e in sorted(window, key=lambda x: x["days_away"])[:3]
            ],
        },
        "recommendations": recs,
    }
