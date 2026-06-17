/**
 * Hijri/Gregorian dual-date utilities.
 * Default display is Gregorian with Hijri as secondary.
 *
 * Saudi-generic + dependency-free (uses only `Intl`), so it lives in `@repo/ui`
 * and is re-exported from `apps/web/lib/hijri.ts` for back-compat.
 */

export function formatHijri(date: Date | string, lang: "ar" | "en" = "ar"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  try {
    // -nu-latn pins Western digits (CX-019); keep Arabic month names + Hijri calendar.
    const locale = lang === "ar" ? "ar-SA-u-ca-islamic-nu-latn" : "en-US-u-ca-islamic";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

export function formatGregorian(date: Date | string, lang: "ar" | "en" = "ar"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export function formatDualDate(date: Date | string, lang: "ar" | "en" = "ar"): string {
  const greg = formatGregorian(date, lang);
  const hijri = formatHijri(date, lang);
  if (!greg) return "";
  if (!hijri) return greg;
  return `${greg} | ${hijri}`;
}
