import { cookies } from "next/headers";

// Server-side language facade. This is a PLAIN module (NOT "use server") so it
// may export non-async helpers and be imported directly by Server Components.
// The single source of truth for the active language at request time is the
// `mimaric-lang` cookie, written client-side by LanguageProvider. A Server
// Component cannot read localStorage, so the cookie is what makes language
// server-readable for RSC + the root <html lang/dir>.

export type Lang = "ar" | "en";

export const LANG_COOKIE = "mimaric-lang";

/** Returns the explicitly-stored language, or null when no valid cookie is set. */
export async function getLangCookie(): Promise<Lang | null> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return value === "en" || value === "ar" ? value : null;
}

/** The active language, defaulting to Arabic (Arabic-first, §6.15) when unset. */
export async function getLang(): Promise<Lang> {
  return (await getLangCookie()) ?? "ar";
}

/**
 * Server-side `t()` facade — same `t(ar, en)` signature as the client
 * `useLanguage().t`, so the inline-pair pattern reads identically in Server
 * Components and Client Components.
 */
export async function getT(): Promise<{
  lang: Lang;
  t: (ar: string, en: string) => string;
}> {
  const lang = await getLang();
  return { lang, t: (ar, en) => (lang === "ar" ? ar : en) };
}
