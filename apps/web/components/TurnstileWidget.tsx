"use client";

import * as React from "react";

/**
 * Dependency-free Cloudflare Turnstile widget (E1 registration hardening).
 *
 * No npm package — injects the raw Cloudflare api.js once and renders the widget
 * via the explicit-render API so we control lifecycle (reset on expire/error).
 *
 * Gated on NEXT_PUBLIC_TURNSTILE_SITE_KEY: when the site key is UNSET this
 * component renders NOTHING and the parent must NOT gate submit on a token
 * (local/undeployed registration keeps working). The matching server gate
 * (verifyTurnstile) is likewise a no-op when TURNSTILE_SECRET_KEY is unset.
 *
 * Token lifecycle:
 *   • onVerify(token)  → solved; parent enables submit and passes token to the action.
 *   • onExpire()       → token aged out; parent clears it and we auto-reset the widget.
 *   • onError()        → challenge errored; parent clears it.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          language?: string;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onloadTurnstileCallback";

export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  lang = "en",
}: {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  lang?: "ar" | "en";
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);

  // Keep the latest callbacks in refs so re-renders don't re-trigger the script /
  // render effect (which must run exactly once per mount).
  const cbRef = React.useRef({ onVerify, onExpire, onError });
  cbRef.current = { onVerify, onExpire, onError };

  React.useEffect(() => {
    if (!siteKey) return; // disabled — render nothing, no gating

    function renderWidget() {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey!,
        theme: "auto",
        language: lang,
        callback: (token: string) => cbRef.current.onVerify(token),
        "expired-callback": () => {
          cbRef.current.onExpire?.();
          if (window.turnstile && widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
        "error-callback": () => cbRef.current.onError?.(),
      });
    }

    // If the API is already present (e.g. navigating back), render immediately.
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Otherwise expose the onload hook and inject the script once.
    window.onloadTurnstileCallback = renderWidget;
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget already gone */
        }
      }
      widgetIdRef.current = null;
    };
    // siteKey/lang are stable for the lifetime of the form; render once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
