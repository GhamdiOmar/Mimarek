/**
 * Number / currency / date formatting that pins **Western (Latin) digits** in
 * both languages. Modern Saudi digital products (Absher, Aqar, Bayut) and every
 * ZATCA/Ejar integration use 0–9, and Mimarek KPI values already do — so AR
 * surfaces must not switch to Arabic-Indic digits (٠–٩).
 *
 * Resolves CX-019: AR dates were rendering Arabic-Indic digits while metrics
 * used Western, an inconsistency on the same screen. The `ar-SA-u-nu-latn`
 * locale keeps Arabic month/weekday names and RTL formatting but forces Latin
 * digits. Prefer these helpers in new code; existing `lang === "ar" ? "ar-SA"`
 * formatter call sites are migrated to the `-u-nu-latn` variant.
 */

export type Lang = "ar" | "en";

/** Number/currency locale — Latin digits in both languages. */
export const numberLocale = (lang: Lang): string => (lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA");

/** Date locale — Latin digits, Arabic month/weekday names in AR. */
export const dateLocale = (lang: Lang): string => (lang === "ar" ? "ar-SA-u-nu-latn" : "en-US");

export function formatNumber(value: number, lang: Lang, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(numberLocale(lang), options).format(value);
}

/** SAR amount with the right suffix/placement per language, Western digits. */
export function formatSar(value: number, lang: Lang, options?: Intl.NumberFormatOptions): string {
  const n = new Intl.NumberFormat(numberLocale(lang), { maximumFractionDigits: 2, ...options }).format(value);
  return lang === "ar" ? `${n} ر.س` : `SAR ${n}`;
}

export function formatDate(
  date: Date | string,
  lang: Lang,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(dateLocale(lang), options).format(d);
}
