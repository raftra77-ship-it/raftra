// Mirrors backend/core/chat_policy.py, which is the rule that is actually enforced. This copy
// only gives instant feedback before a message is sent.
//
// It replaces a keyword list ("insta", "wa ", "upi id", "dm me"...) that blocked ordinary
// talk about the work - "1 Instagram Reel" contains "insta" - while never being checked on
// the server at all.

const LINK = /\b(?:wa\.me|chat\.whatsapp\.com|api\.whatsapp\.com|t\.me|telegram\.me)\b/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const UPI = /\b[\w.-]{2,}@(?:ok[a-z]+|ybl|ibl|axl|upi|paytm|apl|yapl|fbl|freecharge|axisbank|icici|hdfcbank|sbi|kotak|pingpay|jupiteraxis|slc|idfcbank)\b/i;
const PHONE = /(?<![\d₹])(?:\+?\d{1,3}[\s.-]?)?(?:\d[\s.-]?){9}\d(?!\d)/;

/** A short description of the contact detail found, or null when the text is fine. */
export function contactViolation(text: string): string | null {
  const t = text || '';
  if (LINK.test(t)) return 'WhatsApp or Telegram links';
  if (UPI.test(t)) return 'UPI IDs';
  if (EMAIL.test(t)) return 'email addresses';
  if (PHONE.test(t)) return 'phone numbers';
  return null;
}

export const policyMessage = (what: string) =>
  `Messages can't include ${what}. Keep negotiation and payment on Raftra so both sides have a record of what was agreed.`;
