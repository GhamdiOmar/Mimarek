// ─── Helpers ──────────────────────────────────────────────────────────────────

import { ALL_STATUS_CONFIGS } from "./crm-config";

const DEFAULT_STATUS_CONFIG = ALL_STATUS_CONFIGS[0]!;

export function getStatusConfig(key: string) {
  return ALL_STATUS_CONFIGS.find((s) => s.key === key) ?? DEFAULT_STATUS_CONFIG;
}

export function formatSAR(amount: number | string | null | undefined, locale: string) {
  if (!amount) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(num);
}
