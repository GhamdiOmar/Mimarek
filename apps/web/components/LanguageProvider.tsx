"use client";

import * as React from "react";

export type Lang = "ar" | "en";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  dir: "rtl" | "ltr";
  /**
   * Inline-pair translator. `t("مرحبا", "Hello")` → the active-language string.
   * Same signature as the server `getT().t` so the pattern reads identically
   * on both runtimes. Adopt in new/touched code; replaces `lang === "ar" ? …`.
   */
  t: (ar: string, en: string) => string;
}

const LanguageContext = React.createContext<LanguageContextValue>({
  lang: "ar",
  setLang: () => {},
  dir: "rtl",
  t: (ar) => ar,
});

const LANG_KEY = "mimaric-lang";

function writeLangCookie(lang: Lang) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // Functional/necessary preference (no personal data) — set without consent
  // per PDPL; readable server-side for RSC and the root <html lang/dir>.
  document.cookie = `${LANG_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  /**
   * Server-read language (from the `mimaric-lang` cookie) threaded down from a
   * Server Component. When provided it is authoritative — server SSR and client
   * hydration agree, so there is no flash and no second pass. When absent
   * (legacy mounts, or a pre-cookie returning user) we fall back to the
   * post-hydration localStorage read for a one-time migration.
   */
  initialLang?: Lang;
}) {
  const [lang, setLangState] = React.useState<Lang>(initialLang ?? "ar");
  const [hydrated, setHydrated] = React.useState(false);

  // One-time migration / legacy fallback: only when the server did NOT thread a
  // cookie-backed language. Existing EN users (localStorage set, cookie absent)
  // switch once here; the persist effect then writes the cookie so every future
  // request is flash-free.
  React.useEffect(() => {
    if (initialLang == null) {
      try {
        const stored = localStorage.getItem(LANG_KEY) as Lang | null;
        if (stored === "en" || stored === "ar") setLangState(stored);
      } catch {
        /* private mode — ignore */
      }
    }
    setHydrated(true);
  }, [initialLang]);

  // Persist every change to BOTH the cookie (server-readable) and localStorage
  // (back-compat). Runs once on mount too, write-through migrating the cookie.
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* private mode — ignore */
    }
    writeLangCookie(lang);
  }, [lang, hydrated]);

  // Sync the <html> element so Tailwind's rtl: variants and CSS logical
  // properties align with the user's language choice across every page.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const nextDir = lang === "ar" ? "rtl" : "ltr";
    if (root.getAttribute("dir") !== nextDir) root.setAttribute("dir", nextDir);
    if (root.getAttribute("lang") !== lang) root.setAttribute("lang", lang);
  }, [lang]);

  const setLang = React.useCallback((newLang: Lang) => {
    setLangState(newLang);
  }, []);

  const dir = lang === "ar" ? "rtl" : "ltr";
  const t = React.useCallback(
    (ar: string, en: string) => (lang === "ar" ? ar : en),
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, dir, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return React.useContext(LanguageContext);
}
