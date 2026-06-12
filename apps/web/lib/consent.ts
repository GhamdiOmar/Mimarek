// Client-safe cookie-consent helpers (NO next/headers — importable in client
// components). The consent record is the PDPL "documented consent": versioned,
// timestamped, and locale-stamped so the choice is provable. Bumping
// CONSENT_VERSION invalidates every stored choice → everyone is re-prompted.

export const CONSENT_COOKIE = "mimaric-consent";
export const CONSENT_VERSION = 1;
/** Fired by `openCookiePreferences()`; ConsentProvider listens to re-open the sheet. */
export const CONSENT_EVENT = "mimaric:open-cookie-preferences";

export type ConsentMethod = "banner" | "preferences";

export interface ConsentCategories {
  /** Strictly necessary (language, theme, auth session). Always on, never gated. */
  necessary: true;
  /** Analytics (GA4/GTM). Opt-in, default OFF. */
  analytics: boolean;
}

export interface ConsentRecord {
  v: number;
  ts: string; // ISO-8601 UTC — when the choice was made
  method: ConsentMethod; // how it was captured
  locale: "ar" | "en"; // language the notice was shown in (informed-consent proof)
  categories: ConsentCategories;
}

export function parseConsent(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(raw));
    if (!obj || typeof obj !== "object") return null;
    if (obj.v !== CONSENT_VERSION) return null; // stale version → re-prompt
    if (!obj.categories || typeof obj.categories.analytics !== "boolean") return null;
    return obj as ConsentRecord;
  } catch {
    return null;
  }
}

export function readConsentCookie(): ConsentRecord | null {
  if (typeof document === "undefined") return null;
  const prefix = CONSENT_COOKIE + "=";
  const match = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  return parseConsent(match ? match.slice(prefix.length) : null);
}

export function writeConsentCookie(record: ConsentRecord): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const value = encodeURIComponent(JSON.stringify(record));
  // 12-month retention; re-prompt yearly.
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}

/** Open the "Manage cookies" preferences sheet from anywhere (footer, settings). */
export function openCookiePreferences(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSENT_EVENT));
}
