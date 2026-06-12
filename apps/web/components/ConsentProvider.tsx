"use client";

import * as React from "react";
import { AnalyticsProvider } from "./AnalyticsProvider";
import { CookieConsent } from "./CookieConsent";
import { recordConsent } from "../app/actions/consent";
import {
  CONSENT_EVENT,
  CONSENT_VERSION,
  readConsentCookie,
  writeConsentCookie,
  type ConsentMethod,
  type ConsentRecord,
} from "../lib/consent";

type Lang = "ar" | "en";

interface ConsentContextValue {
  analyticsGranted: boolean;
  openPreferences: () => void;
}

const ConsentContext = React.createContext<ConsentContextValue>({
  analyticsGranted: false,
  openPreferences: () => {},
});

export function useConsent() {
  return React.useContext(ConsentContext);
}

/**
 * PDPL cookie-consent controller. Mounted once at the root. Owns the consent
 * record, decides whether analytics may load (block-until-consent — GA4/GTM is
 * NOT injected until the user grants the Analytics category, so zero Google
 * network calls fire pre-consent), and renders the banner + preferences sheet.
 */
export function ConsentProvider({
  children,
  initialLang,
  gtmContainerId,
  ga4MeasurementId,
}: {
  children: React.ReactNode;
  initialLang: Lang;
  gtmContainerId?: string | null;
  ga4MeasurementId?: string | null;
}) {
  const [consent, setConsent] = React.useState<ConsentRecord | null>(null);
  const [decided, setDecided] = React.useState(false); // cookie read complete
  const [bannerOpen, setBannerOpen] = React.useState(false);
  const [prefsOpen, setPrefsOpen] = React.useState(false);

  // Live language: start from the server value, then track <html lang> so the
  // banner/sheet follow a runtime language toggle without LanguageProvider.
  const [lang, setLang] = React.useState<Lang>(initialLang);
  React.useEffect(() => {
    const read = () => {
      const l = document.documentElement.getAttribute("lang");
      if (l === "ar" || l === "en") setLang(l);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => obs.disconnect();
  }, []);

  // Read the stored choice once on mount; show the banner only if none/stale.
  React.useEffect(() => {
    const existing = readConsentCookie();
    setConsent(existing);
    setBannerOpen(existing == null);
    setDecided(true);
  }, []);

  // Allow "Cookie settings" affordances anywhere to re-open the sheet.
  React.useEffect(() => {
    const open = () => setPrefsOpen(true);
    window.addEventListener(CONSENT_EVENT, open);
    return () => window.removeEventListener(CONSENT_EVENT, open);
  }, []);

  const commit = React.useCallback(
    (analytics: boolean, method: ConsentMethod) => {
      const prevAnalytics = consent?.categories.analytics ?? false;
      const record: ConsentRecord = {
        v: CONSENT_VERSION,
        ts: new Date().toISOString(),
        method,
        locale: lang,
        categories: { necessary: true, analytics },
      };
      writeConsentCookie(record);
      setConsent(record);
      setBannerOpen(false);
      setPrefsOpen(false);
      // Fire-and-forget server-side audit trail (PDPL documented consent).
      void recordConsent({
        version: CONSENT_VERSION,
        analytics,
        necessary: true,
        locale: lang,
        method,
      }).catch(() => {});
      // Withdrawal (analytics on → off): reload to fully tear down GA4/GTM and
      // stop collection "without undue delay" (PDPL). Granting just re-renders.
      if (prevAnalytics && !analytics) window.location.reload();
    },
    [consent, lang],
  );

  const analyticsGranted = decided && consent?.categories.analytics === true;

  const ctx = React.useMemo<ConsentContextValue>(
    () => ({ analyticsGranted, openPreferences: () => setPrefsOpen(true) }),
    [analyticsGranted],
  );

  return (
    <ConsentContext.Provider value={ctx}>
      {children}
      {analyticsGranted ? (
        <AnalyticsProvider
          gtmContainerId={gtmContainerId}
          ga4MeasurementId={ga4MeasurementId}
        />
      ) : null}
      <CookieConsent
        lang={lang}
        bannerOpen={bannerOpen}
        prefsOpen={prefsOpen}
        currentAnalytics={consent?.categories.analytics ?? false}
        onAcceptAll={() => commit(true, "banner")}
        onRejectAll={() => commit(false, "banner")}
        onSavePreferences={(analytics) => commit(analytics, "preferences")}
        onOpenPreferences={() => setPrefsOpen(true)}
        onClosePreferences={() => setPrefsOpen(false)}
      />
    </ConsentContext.Provider>
  );
}
