"use client";

import { useEffect } from "react";

const GTM_PATTERN = /^GTM-[A-Z0-9]+$/;
const GA4_PATTERN = /^G-[A-Z0-9]+$/;

// Minimal shape of the Google Tag globals attached to `window`. Typed locally so
// we never reach for `any` — gtag is variadic, dataLayer is a push-only queue.
type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

export function AnalyticsProvider({
  gtmContainerId,
  ga4MeasurementId,
}: {
  gtmContainerId?: string | null;
  ga4MeasurementId?: string | null;
}) {
  // This component is only rendered once the user has granted Analytics consent
  // (gated by ConsentProvider — block-until-consent, so nothing loads before
  // then). We still set Google Consent Mode v2 signals for correct state:
  // analytics_storage → granted; all ad_* signals stay denied (no ads stack).
  useEffect(() => {
    const w = window as GtagWindow;
    const dataLayer = (w.dataLayer = w.dataLayer || []);
    const gtag = (w.gtag =
      w.gtag || function (...args: unknown[]) { dataLayer.push(args); });
    gtag("consent", "default", {
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    if (gtmContainerId && GTM_PATTERN.test(gtmContainerId)) {
      dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });

      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmContainerId}`;
      document.head.appendChild(script);
    } else if (ga4MeasurementId && GA4_PATTERN.test(ga4MeasurementId)) {
      gtag("js", new Date());
      gtag("config", ga4MeasurementId);

      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}`;
      document.head.appendChild(script);
    }
  }, [gtmContainerId, ga4MeasurementId]);

  return null;
}
