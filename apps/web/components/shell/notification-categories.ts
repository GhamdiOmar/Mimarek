/**
 * Shared notification category definitions — imported by both the desktop
 * popover (AppTopbar) and the mobile sheet (MobileNotificationsSheet).
 * Plain module — NOT "use client" / "use server".
 */

export type NotifCategory = "all" | "alerts" | "reminders" | "updates";

/** Map a notification `type` string to a coarse filter category. */
export function categorizeNotification(
  type?: string,
): Exclude<NotifCategory, "all"> {
  const t = (type ?? "").toUpperCase();
  if (/OVERDUE|REJECT|FAIL|ALERT|EXPIRED|BREACH|CANCEL|ERROR/.test(t))
    return "alerts";
  if (/DUE|EXPIRY|REMIND|RENEWAL|UPCOMING|SCHEDULE/.test(t)) return "reminders";
  return "updates";
}

export const NOTIF_CATEGORIES: {
  key: NotifCategory;
  label: { ar: string; en: string };
}[] = [
  { key: "all", label: { ar: "الكل", en: "All" } },
  { key: "alerts", label: { ar: "تنبيهات", en: "Alerts" } },
  { key: "reminders", label: { ar: "تذكيرات", en: "Reminders" } },
  { key: "updates", label: { ar: "تحديثات", en: "Updates" } },
];
