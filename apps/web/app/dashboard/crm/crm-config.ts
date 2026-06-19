// ─── Pipeline Stage Config ────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  {
    key: "NEW",
    label: { ar: "جديد", en: "New Lead" },
    color: "bg-info/10 text-info-strong border-info/30",
    dotColor: "bg-info",
  },
  {
    key: "CONTACTED",
    label: { ar: "تم التواصل", en: "Contacted" },
    color: "bg-primary/10 text-primary border-primary/30",
    dotColor: "bg-primary",
  },
  {
    key: "QUALIFIED",
    label: { ar: "مؤهل", en: "Qualified" },
    color: "bg-warning/10 text-warning-strong border-warning/30",
    dotColor: "bg-warning",
  },
  {
    key: "VIEWING",
    label: { ar: "معاينة", en: "Viewing" },
    color: "bg-warning/10 text-warning-strong border-warning/30",
    dotColor: "bg-warning",
  },
  {
    key: "NEGOTIATION",
    label: { ar: "تفاوض", en: "Negotiation" },
    color: "bg-success/10 text-success-strong border-success/30",
    dotColor: "bg-success",
  },
];

// Per-stage hue for Kanban column tinting. Kept as raw HSL so we can mix into
// the card surface via color-mix() without fighting Tailwind's class-generation.
export const STAGE_HUES: Record<string, string> = {
  NEW: "hsl(220 15% 60%)", // neutral
  CONTACTED: "hsl(210 65% 55%)", // blue
  INTERESTED: "hsl(185 60% 45%)", // teal
  QUALIFIED: "hsl(186 90% 30%)", // deep teal
  VIEWING: "hsl(40 55% 55%)", // gold
  NEGOTIATION: "hsl(40 60% 50%)", // darker gold
  RESERVED: "hsl(158 50% 45%)", // green
  CONVERTED: "hsl(158 55% 35%)", // deep green
  LOST: "hsl(0 65% 55%)", // red
};

// Deal.stage → bilingual label (drawer interest badges). Mirrors the DealStage
// enum in @repo/db.
export const DEAL_STAGE_LABELS: Record<string, { ar: string; en: string }> = {
  NEW: { ar: "جديد", en: "New" },
  QUALIFIED: { ar: "مؤهل", en: "Qualified" },
  VIEWING: { ar: "معاينة", en: "Viewing" },
  NEGOTIATION: { ar: "تفاوض", en: "Negotiation" },
  RESERVED: { ar: "محجوز", en: "Reserved" },
  WON: { ar: "مكسوب", en: "Won" },
  LOST: { ar: "خسارة", en: "Lost" },
};

// Legacy statuses not shown in kanban but valid for filter/display
export const ALL_STATUS_CONFIGS = [
  ...PIPELINE_STAGES,
  {
    key: "INTERESTED",
    label: { ar: "مهتم", en: "Interested" },
    color: "bg-primary/10 text-primary border-primary/30",
    dotColor: "bg-primary",
  },
  {
    key: "RESERVED",
    label: { ar: "محجوز", en: "Reserved" },
    color: "bg-info/10 text-info-strong border-info/30",
    dotColor: "bg-info",
  },
  {
    key: "CONVERTED",
    label: { ar: "تم التحويل", en: "Converted" },
    color: "bg-success/10 text-success-strong border-success/30",
    dotColor: "bg-success",
  },
  {
    key: "LOST",
    label: { ar: "خسارة", en: "Lost" },
    color: "bg-destructive/10 text-destructive border-destructive/30",
    dotColor: "bg-destructive",
  },
  {
    key: "ACTIVE_TENANT",
    label: { ar: "مستأجر نشط", en: "Active Tenant" },
    color: "bg-info/10 text-info-strong border-info/30",
    dotColor: "bg-info",
  },
  {
    key: "PAST_TENANT",
    label: { ar: "مستأجر سابق", en: "Past Tenant" },
    color: "bg-muted text-muted-foreground border-border",
    dotColor: "bg-muted-foreground",
  },
];

export const LOST_REASONS = [
  { key: "BUDGET", label: { ar: "الميزانية غير مناسبة", en: "Budget mismatch" } },
  { key: "NO_RESPONSE", label: { ar: "لا يوجد رد", en: "No response" } },
  { key: "COMPETITOR", label: { ar: "اختار منافساً", en: "Chose competitor" } },
  { key: "NO_MATCH", label: { ar: "لا يوجد عقار مناسب", en: "No suitable property" } },
  { key: "OTHER", label: { ar: "سبب آخر", en: "Other reason" } },
];

export const PROPERTY_TYPES = [
  { key: "APARTMENT", label: { ar: "شقة", en: "Apartment" } },
  { key: "VILLA", label: { ar: "فيلا", en: "Villa" } },
  { key: "OFFICE", label: { ar: "مكتب", en: "Office" } },
  { key: "RETAIL", label: { ar: "تجاري", en: "Retail" } },
  { key: "WAREHOUSE", label: { ar: "مستودع", en: "Warehouse" } },
  { key: "LAND", label: { ar: "أرض", en: "Land" } },
];

export const SOURCE_LABELS: Record<string, { ar: string; en: string }> = {
  REFERRAL: { ar: "إحالة", en: "Referral" },
  WALK_IN: { ar: "زيارة مباشرة", en: "Walk-in" },
  ONLINE: { ar: "إنترنت", en: "Online" },
  EXHIBITION: { ar: "معرض", en: "Exhibition" },
  COLD_CALL: { ar: "اتصال بارد", en: "Cold Call" },
  SOCIAL_MEDIA: { ar: "وسائل التواصل", en: "Social Media" },
  MARKETPLACE: { ar: "السوق", en: "Marketplace" },
};
