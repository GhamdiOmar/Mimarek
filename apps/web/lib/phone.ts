/**
 * Saudi mobile phone normalization to E.164.
 *
 * The SINGLE source of phone normalization in the app. It is used at BOTH
 * write time (encrypt + blind-index hash) and search time, because a blind
 * index only matches when the value is normalized identically on both sides
 * (CipherSweet / blind-index practice). Do not inline ad-hoc phone parsing
 * elsewhere — route every phone through this function.
 *
 * Accepts the common ways a Saudi mobile is entered:
 *   05XXXXXXXX · 5XXXXXXXX · 9665XXXXXXXX · +9665XXXXXXXX · 009665XXXXXXXX
 * (spaces, dashes, parentheses and dots are tolerated).
 *
 * Returns the canonical `+9665XXXXXXXX` form, or `null` for anything that is
 * not a valid Saudi mobile — including masked PII (`******4567`), ciphertext
 * (the `iv:authTag:ciphertext` 3-part format), and junk. A `null` result means
 * "no usable phone": callers omit Call/WhatsApp affordances, never render a
 * broken `tel:` link.
 */
export function normalizeSaudiPhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Masked PII or encrypted ciphertext must never be treated as a phone.
  if (raw.includes("*") || raw.includes(":")) return null;

  // Strip formatting characters humans type. A leading + is meaningful; keep it.
  let s = raw.trim().replace(/[\s\-().]/g, "");

  // Reject if anything other than digits and a single leading + remains.
  if (!/^\+?\d+$/.test(s)) return null;

  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2); // international 00 prefix
  if (s.startsWith("966")) s = s.slice(3); // country code
  else if (s.startsWith("0")) s = s.slice(1); // national trunk 0

  // National significant number for a Saudi mobile: 5 followed by 8 digits.
  if (!/^5\d{8}$/.test(s)) return null;

  return `+966${s}`;
}

/**
 * WhatsApp wa.me link target: full international number, digits only, no `+`
 * or leading zeros (faq.whatsapp.com). Returns null when there is no usable
 * phone, so callers can omit the WhatsApp control.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const e164 = normalizeSaudiPhoneE164(raw);
  return e164 ? e164.slice(1) : null; // drop the leading +
}
