"""
The Indian retail calendar: the dates a brand plans campaigns around.

Three hardcoded entries lived in the Marketing Calendar's frontend (Ganesh Chaturthi,
Navratri, Diwali) purely as decoration - nothing read them, so "consider relevant festivals
while planning campaigns" was not happening anywhere. Moving them to the backend is what
lets the campaign agents see them, via core.brand_context.

Why the dates are hardcoded rather than computed. Most Indian festivals follow lunar
calendars, so their Gregorian dates shift by weeks each year and cannot be derived without
a panchang library. A wrong Diwali date is worse than no date - a brand would build its
biggest campaign of the year around it - so these are transcribed per year and the module
says plainly when it has run out, instead of extrapolating.

`lead_days` is the part that makes this useful for planning rather than just display:
festive commerce is won in the run-up, not on the day. Diwali creative that goes live on
Diwali has missed the purchase window entirely.
"""
import datetime
from typing import List, Optional

# name, ISO date, category, lead_days (how long before the date campaigns should be live)
_CALENDAR = {
    2026: [
        ("Republic Day Sales", "2026-01-26", "National holiday / sale", 10),
        ("Valentine's Day", "2026-02-14", "Gifting", 14),
        ("Holi", "2026-03-03", "Festival / colour campaigns", 12),
        ("Ugadi & Gudi Padwa", "2026-03-19", "Regional new year", 10),
        ("Eid al-Fitr", "2026-03-20", "Festival / gifting", 12),
        ("Baisakhi", "2026-04-14", "Regional harvest festival", 10),
        ("Akshaya Tritiya", "2026-04-19", "Auspicious buying (gold, high-ticket)", 12),
        ("Mother's Day", "2026-05-10", "Gifting", 14),
        ("Father's Day", "2026-06-21", "Gifting", 14),
        ("Independence Day Sales", "2026-08-15", "National holiday / sale", 10),
        ("Raksha Bandhan", "2026-08-28", "Gifting / sibling campaigns", 14),
        ("Ganesh Chaturthi", "2026-09-14", "Festival / festive shopping", 12),
        ("Onam", "2026-08-26", "Regional festival (Kerala)", 12),
        ("Navratri begins", "2026-10-11", "Big festive blitz", 14),
        ("Dussehra", "2026-10-20", "Festive purchase peak", 12),
        ("Dhanteras", "2026-11-06", "Highest-intent buying day", 14),
        ("Diwali", "2026-11-08", "Peak shopping season", 21),
        ("Black Friday", "2026-11-27", "Global sale event", 10),
        ("Cyber Monday", "2026-11-30", "Global sale event", 7),
        ("Christmas", "2026-12-25", "Gifting", 18),
        ("New Year's Eve", "2026-12-31", "Year-end sale", 10),
    ],
    2027: [
        ("Republic Day Sales", "2027-01-26", "National holiday / sale", 10),
        ("Valentine's Day", "2027-02-14", "Gifting", 14),
        ("Holi", "2027-03-22", "Festival / colour campaigns", 12),
        ("Eid al-Fitr", "2027-03-10", "Festival / gifting", 12),
        ("Akshaya Tritiya", "2027-05-08", "Auspicious buying (gold, high-ticket)", 12),
        ("Independence Day Sales", "2027-08-15", "National holiday / sale", 10),
        ("Raksha Bandhan", "2027-08-17", "Gifting / sibling campaigns", 14),
        ("Ganesh Chaturthi", "2027-09-04", "Festival / festive shopping", 12),
        ("Navratri begins", "2027-09-30", "Big festive blitz", 14),
        ("Dussehra", "2027-10-09", "Festive purchase peak", 12),
        ("Dhanteras", "2027-10-27", "Highest-intent buying day", 14),
        ("Diwali", "2027-10-29", "Peak shopping season", 21),
        ("Black Friday", "2027-11-26", "Global sale event", 10),
        ("Christmas", "2027-12-25", "Gifting", 18),
    ],
}

COVERED_YEARS = sorted(_CALENDAR.keys())


def all_dates(region: str = "IN") -> List[dict]:
    """Every known date, ascending. `region` is accepted for future markets; only IN today."""
    out = []
    for year in COVERED_YEARS:
        for name, iso, category, lead in _CALENDAR[year]:
            out.append({"name": name, "date": iso, "category": category,
                        "lead_days": lead, "region": "IN"})
    out.sort(key=lambda e: e["date"])
    return out


def upcoming(within_days: int = 120, today: Optional[datetime.date] = None) -> List[dict]:
    """Dates falling in the next `within_days`, each annotated for planning.

    `campaign_start` is the date creative should be live by, and `planning_urgency` says
    whether that has already passed - which is the question a marketer actually has when
    they open a calendar in October.
    """
    today = today or datetime.date.today()
    horizon = today + datetime.timedelta(days=within_days)
    out = []
    for e in all_dates():
        d = datetime.date.fromisoformat(e["date"])
        if d < today or d > horizon:
            continue
        start = d - datetime.timedelta(days=e["lead_days"])
        days_to_start = (start - today).days
        out.append({
            **e,
            "days_away": (d - today).days,
            "campaign_start": start.isoformat(),
            "planning_urgency": ("overdue" if days_to_start < 0
                                 else "start_now" if days_to_start <= 7
                                 else "upcoming"),
        })
    return out


def calendar_context(within_days: int = 90, today: Optional[datetime.date] = None) -> str:
    """A compact block for the campaign/creative agents' prompts.

    This is the point of moving the calendar server-side: an agent asked to plan a campaign
    in late September should know Diwali is six weeks out and that creative needs to be live
    three weeks before it, without the user having to say so.
    """
    rows = upcoming(within_days, today)
    if not rows:
        latest = COVERED_YEARS[-1] if COVERED_YEARS else "?"
        return ("No retail calendar dates are known for the next %d days "
                "(the calendar currently runs to %s)." % (within_days, latest))
    lines = ["UPCOMING RETAIL / FESTIVE DATES (India), with the date campaigns should be live by:"]
    for r in rows:
        lines.append("- %s on %s (%s) - %d days away; run creative from %s%s"
                     % (r["name"], r["date"], r["category"], r["days_away"],
                        r["campaign_start"],
                        " - START NOW" if r["planning_urgency"] in ("overdue", "start_now") else ""))
    return "\n".join(lines)
