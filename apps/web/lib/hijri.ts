/**
 * Hijri/Gregorian dual-date utilities.
 *
 * The implementation moved to `@repo/ui` (`packages/ui/src/lib/hijri.ts`) — it
 * is Saudi-generic and dependency-free. This file is a thin re-export kept so
 * existing relative importers (e.g. `../../../../lib/hijri`) don't need to
 * change. New code may import directly from `@repo/ui`.
 */
export { formatHijri, formatGregorian, formatDualDate } from "@repo/ui";
