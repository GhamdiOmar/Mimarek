"use client";

import { useEffect } from "react";

const GTM_PATTERN = /^GTM-[A-Z0-9]+$/;
const GA4_PATTERN = /^G-[A-Z0-9]+$/;

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
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.gtag = w.gtag || function (...args: unknown[]) { w.dataLayer.push(args); };
    w.gtag("consent", "default", {
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    w.gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    if (gtmContainerId && GTM_PATTERN.test(gtmContainerId)) {
      w.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });

      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmContainerId}`;
      document.head.appendChild(script);
    } else if (ga4MeasurementId && GA4_PATTERN.test(ga4MeasurementId)) {
      w.gtag("js", new Date());
      w.gtag("config", ga4MeasurementId);

      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}`;
      document.head.appendChild(script);
    }
  }, [gtmContainerId, ga4MeasurementId]);

  return null;
}
