import { startOfDay, subDays } from "date-fns";

/** Build an array of N Date boundaries at UTC 00:00 walking backwards from today. */
export function dayBuckets(days: number): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, i) =>
    startOfDay(subDays(today, days - 1 - i)),
  );
}

export function dayIndex(d: Date, start: Date): number {
  return Math.floor(
    (startOfDay(d).getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
}
