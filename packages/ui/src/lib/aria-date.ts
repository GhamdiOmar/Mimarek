/**
 * Date ⇄ react-aria interop helpers.
 *
 * The Mimaric date pickers expose Date-based (and ISO-string-based) public
 * APIs to consumers, but react-aria's calendar components work in
 * `@internationalized/date` value space. These null-safe converters live at
 * the component boundary so the public contracts (Date / "YYYY-MM-DD") never
 * change.
 *
 * Hijri contract (AGENTS.md §6.15.3): the stored value is always
 * Gregorian-backed. When a react-aria value comes back in a non-Gregorian
 * calendar (e.g. Islamic Umm al-Qura), `calendarDateToDate` normalises it to
 * Gregorian via `toCalendar(cd, new GregorianCalendar())` before producing the
 * `Date`, so toggling the display calendar never mutates the stored system.
 */
import {
  CalendarDate,
  GregorianCalendar,
  parseDate,
  toCalendar,
  type DateValue,
} from "@internationalized/date";

/** Local Y/M/D of a `Date` → react-aria `CalendarDate` (Gregorian). Null-safe. */
export function dateToCalendarDate(
  d: Date | null | undefined,
): CalendarDate | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * react-aria `DateValue` → JS `Date` (local midnight). Normalises any calendar
 * system back to Gregorian first, so the emitted `Date` is always Gregorian.
 * Null-safe.
 */
export function calendarDateToDate(
  cd: DateValue | null | undefined,
): Date | null {
  if (!cd) return null;
  const greg = toCalendar(cd, new GregorianCalendar());
  return new Date(greg.year, greg.month - 1, greg.day);
}

/** ISO "YYYY-MM-DD" → react-aria `CalendarDate` (Gregorian). Null-safe. */
export function isoToCalendarDate(
  iso: string | null | undefined,
): CalendarDate | null {
  if (!iso) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
}

/** react-aria `DateValue` → ISO "YYYY-MM-DD" (Gregorian). Null-safe. */
export function calendarDateToIso(
  cd: DateValue | null | undefined,
): string | null {
  if (!cd) return null;
  const greg = toCalendar(cd, new GregorianCalendar());
  return greg.toString();
}
