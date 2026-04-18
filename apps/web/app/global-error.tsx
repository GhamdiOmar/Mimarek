"use client";

// Fatal error boundary — rendered when even the root layout throws.
// Intentionally self-contained (no shared UI imports) so a broken ThemeProvider
// or Toaster can't cascade into this component.
import * as React from "react";

const COPY = {
  ar: {
    lang: "ar",
    dir: "rtl" as const,
    heading: "حدث خطأ غير متوقع",
    body: "تعذّر تحميل ميماريك الآن. حاول مرة أخرى، أو تواصل مع الدعم إذا استمرت المشكلة.",
    button: "حاول مرة أخرى",
    reference: "المرجع",
    fontFamily:
      "'IBM Plex Sans Arabic', system-ui, -apple-system, Segoe UI, Tahoma, Arial, sans-serif",
  },
  en: {
    lang: "en",
    dir: "ltr" as const,
    heading: "Something went wrong",
    body: "We couldn’t load Mimaric right now. Try again, or contact support if the problem persists.",
    button: "Try again",
    reference: "Reference",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
};

function pickLocale(): "ar" | "en" {
  if (typeof navigator === "undefined") return "en";
  const preferred = [...(navigator.languages ?? [navigator.language ?? ""])];
  const hasArabic = preferred.some((l) => l?.toLowerCase().startsWith("ar"));
  return hasArabic ? "ar" : "en";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = React.useState<"ar" | "en">("en");

  React.useEffect(() => {
    setLocale(pickLocale());
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  const t = COPY[locale];

  return (
    <html lang={t.lang} dir={t.dir}>
      <body
        style={{
          fontFamily: t.fontFamily,
          margin: 0,
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F9FA",
          color: "#111827",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>{t.heading}</h1>
          <p style={{ color: "#6B7280", marginBottom: 24, lineHeight: 1.6 }}>
            {t.body}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: 0,
              background: "#7339AC",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t.button}
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: 16,
                fontSize: 11,
                color: "#9CA3AF",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                direction: "ltr",
              }}
            >
              {t.reference}: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
