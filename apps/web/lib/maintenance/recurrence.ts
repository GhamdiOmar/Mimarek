export function computeNextRunDate(
  recurrenceType: string,
  interval: number,
  from: Date
): Date {
  const next = new Date(from);
  switch (recurrenceType) {
    case "DAILY":
      next.setDate(next.getDate() + interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7 * interval);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14 * interval);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + interval);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3 * interval);
      break;
    case "SEMI_ANNUAL":
      next.setMonth(next.getMonth() + 6 * interval);
      break;
    case "ANNUAL":
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      next.setMonth(next.getMonth() + interval);
  }
  return next;
}
