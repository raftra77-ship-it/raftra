"""What a marketplace message may not contain.

The brand and creator chat screens both blocked a keyword list client-side only - "insta",
"wa ", "upi id" and so on. Enforced nowhere on the server, it could be bypassed by anyone
calling the API, and it also blocked ordinary talk about the work itself ("1 Instagram
Reel" contains "insta"). The rule here is narrower and authoritative: contact details that
move a negotiation or a payment off the platform - phone numbers, email addresses, UPI IDs
and WhatsApp / Telegram links. src/utils/chatPolicy.ts mirrors it for instant feedback.
"""
import re
from typing import Optional

_LINK = re.compile(r"\b(?:wa\.me|chat\.whatsapp\.com|api\.whatsapp\.com|t\.me|telegram\.me)\b", re.I)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", re.I)
_UPI = re.compile(
    r"\b[\w.-]{2,}@(?:ok[a-z]+|ybl|ibl|axl|upi|paytm|apl|yapl|fbl|freecharge|axisbank|icici|"
    r"hdfcbank|sbi|kotak|pingpay|jupiteraxis|slc|idfcbank)\b", re.I)
# Ten or more digits, optionally separated by spaces, dots or dashes and led by a country code.
# Prices ("₹1,00,000"), dates and follower counts stay well short of that.
_PHONE = re.compile(r"(?<![\d₹])(?:\+?\d{1,3}[\s.-]?)?(?:\d[\s.-]?){9}\d(?!\d)")


def contact_violation(text: str) -> Optional[str]:
    """A short description of the contact detail found, or None when the text is fine."""
    t = text or ""
    if _LINK.search(t):
        return "WhatsApp or Telegram links"
    if _UPI.search(t):
        return "UPI IDs"
    if _EMAIL.search(t):
        return "email addresses"
    if _PHONE.search(t):
        return "phone numbers"
    return None


def policy_detail(what: str) -> str:
    return (f"Messages can't include {what}. Keep negotiation and payment on Raftra so both "
            f"sides have a record of what was agreed.")
