/**
 * domain-labels.ts — canonical bilingual label + badge-variant registry
 *
 * Keys are typed against Prisma enums so a schema enum change breaks the
 * BUILD, not production. Each map uses `satisfies Record<Enum, V>` at
 * definition (compile-time completeness check) then is cast to
 * `Record<string, V>` on export so callers can index with any runtime string
 * without redundant casts in every page.
 *
 * Structure per domain:
 *   <DOMAIN>_LABEL   — Record<string, { ar: string; en: string }>
 *   <DOMAIN>_VARIANT — Record<string, BadgeVariant>
 *
 * Maintenance status includes `variant` in the label object (access pattern
 * required by maintenance/[id]/page.tsx: `statusLabels[s].variant`).
 * Maintenance priority includes `color` in the label object (access pattern
 * required by maintenance/[id]/page.tsx and tickets/page.tsx:
 * `priorityLabels[p].color`).
 */

import type {
  ContractStatus,
  ReservationStatus,
  PaymentStatus,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceCategory,
  MarketplaceListingStatus,
  UnitStatus,
} from "@repo/db";

// ─── Badge variant union (mirrors packages/ui/src/components/Badge.tsx) ───────

type BadgeVariant =
  | "available"
  | "reserved"
  | "sold"
  | "rented"
  | "maintenance"
  | "overdue"
  | "draft"
  | "success"
  | "info"
  | "warning"
  | "pending"
  | "error"
  | "default"
  | "outline"
  | "dot";

// ─── ContractStatus ───────────────────────────────────────────────────────────

export const CONTRACT_STATUS_LABEL = {
  DRAFT: { ar: "مسودة", en: "Draft" },
  SENT: { ar: "مُرسل", en: "Sent" },
  SIGNED: { ar: "موقّع", en: "Signed" },
  CANCELLED: { ar: "ملغي", en: "Cancelled" },
  VOID: { ar: "لاغٍ", en: "Void" },
} satisfies Record<ContractStatus, { ar: string; en: string }> as Record<
  string,
  { ar: string; en: string }
>;

export const CONTRACT_STATUS_VARIANT = {
  DRAFT: "draft",
  SENT: "info",
  SIGNED: "success",
  CANCELLED: "error",
  VOID: "warning",
} satisfies Record<ContractStatus, BadgeVariant> as Record<string, BadgeVariant>;

// ─── ReservationStatus ────────────────────────────────────────────────────────

export const RESERVATION_STATUS_LABEL = {
  PENDING: { ar: "قيد الانتظار", en: "Pending" },
  CONFIRMED: { ar: "مؤكد", en: "Confirmed" },
  EXPIRED: { ar: "منتهي", en: "Expired" },
  CANCELLED: { ar: "ملغي", en: "Cancelled" },
} satisfies Record<ReservationStatus, { ar: string; en: string }> as Record<
  string,
  { ar: string; en: string }
>;

export const RESERVATION_STATUS_VARIANT = {
  PENDING: "pending",
  CONFIRMED: "success",
  EXPIRED: "error",
  CANCELLED: "default",
} satisfies Record<ReservationStatus, BadgeVariant> as Record<string, BadgeVariant>;

// ─── PaymentStatus ────────────────────────────────────────────────────────────

export const PAYMENT_STATUS_LABEL = {
  PAID: { ar: "مدفوع", en: "Paid" },
  UNPAID: { ar: "غير مدفوع", en: "Upcoming" },
  OVERDUE: { ar: "متأخر", en: "Overdue" },
  PARTIALLY_PAID: { ar: "مدفوع جزئياً", en: "Partially Paid" },
} satisfies Record<PaymentStatus, { ar: string; en: string }> as Record<
  string,
  { ar: string; en: string }
>;

export const PAYMENT_STATUS_VARIANT = {
  PAID: "success",
  UNPAID: "pending",
  OVERDUE: "overdue",
  PARTIALLY_PAID: "warning",
} satisfies Record<PaymentStatus, BadgeVariant> as Record<string, BadgeVariant>;

// ─── MaintenanceStatus ────────────────────────────────────────────────────────
// `variant` is included in the label object to match the maintenance/[id]/page.tsx
// access pattern: `statusLabels[s].variant` (used as `Badge variant={… as any}`).

export const MAINTENANCE_STATUS_LABEL = {
  OPEN: { ar: "بانتظار المراجعة", en: "Waiting Review", variant: "draft" },
  ASSIGNED: { ar: "معيّن", en: "Assigned", variant: "reserved" },
  IN_PROGRESS: { ar: "قيد التنفيذ", en: "In Progress", variant: "reserved" },
  ON_HOLD: { ar: "معلّق", en: "On Hold", variant: "maintenance" },
  RESOLVED: { ar: "تم الحل", en: "Resolved", variant: "available" },
  CLOSED: { ar: "مغلق", en: "Closed", variant: "sold" },
} satisfies Record<MaintenanceStatus, { ar: string; en: string; variant: string }> as Record<
  string,
  { ar: string; en: string; variant: string }
>;

// ─── MaintenancePriority ──────────────────────────────────────────────────────
// `color` is included in the label object to match tickets/page.tsx and
// maintenance/[id]/page.tsx access pattern: `priorityLabels[p].color`.

export const MAINTENANCE_PRIORITY_LABEL = {
  LOW: { ar: "منخفض", en: "Low", color: "text-muted-foreground" },
  MEDIUM: { ar: "متوسط", en: "Medium", color: "text-primary" },
  HIGH: { ar: "عالي", en: "High", color: "text-warning" },
  URGENT: { ar: "عاجل", en: "Urgent", color: "text-destructive" },
} satisfies Record<MaintenancePriority, { ar: string; en: string; color: string }> as Record<
  string,
  { ar: string; en: string; color: string }
>;

// ─── MaintenanceCategory ──────────────────────────────────────────────────────

export const MAINTENANCE_CATEGORY_LABEL = {
  HVAC: { ar: "تكييف", en: "HVAC" },
  PLUMBING: { ar: "سباكة", en: "Plumbing" },
  ELECTRICAL: { ar: "كهرباء", en: "Electrical" },
  STRUCTURAL: { ar: "إنشائي", en: "Structural" },
  FIRE_SAFETY: { ar: "سلامة حريق", en: "Fire Safety" },
  ELEVATOR: { ar: "مصاعد", en: "Elevator" },
  CLEANING: { ar: "نظافة", en: "Cleaning" },
  LANDSCAPING: { ar: "تنسيق حدائق", en: "Landscaping" },
  PEST_CONTROL: { ar: "مكافحة آفات", en: "Pest Control" },
  GENERAL: { ar: "عام", en: "General" },
} satisfies Record<MaintenanceCategory, { ar: string; en: string }> as Record<
  string,
  { ar: string; en: string }
>;

// ─── UnitStatus ───────────────────────────────────────────────────────────────
// QA-ARCH-02: added to registry so pages can import instead of declaring local maps.
// Covers all 8 enum members: the 5 common ones + SUSPENDED/WITHDRAWN/HANDED_OVER.

export const UNIT_STATUS_LABEL = {
  AVAILABLE:    { ar: "متاح",           en: "Available" },
  RESERVED:     { ar: "محجوز",          en: "Reserved" },
  SOLD:         { ar: "مباع",           en: "Sold" },
  RENTED:       { ar: "مؤجر",           en: "Rented" },
  MAINTENANCE:  { ar: "صيانة",          en: "Maintenance" },
  SUSPENDED:    { ar: "موقوف مؤقتاً",   en: "Suspended" },
  WITHDRAWN:    { ar: "مسحوب",          en: "Withdrawn" },
  HANDED_OVER:  { ar: "تم التسليم",     en: "Handed Over" },
} satisfies Record<UnitStatus, { ar: string; en: string }> as Record<
  string,
  { ar: string; en: string }
>;

export const UNIT_STATUS_VARIANT = {
  AVAILABLE:   "available",
  RESERVED:    "reserved",
  SOLD:        "sold",
  RENTED:      "rented",
  MAINTENANCE: "maintenance",
  SUSPENDED:   "warning",
  WITHDRAWN:   "default",
  HANDED_OVER: "success",
} satisfies Record<UnitStatus, BadgeVariant> as Record<string, BadgeVariant>;

// ─── MarketplaceListingStatus ─────────────────────────────────────────────────
// The admin/marketplace/page.tsx originally stored English-only strings.
// Arabic strings have been native-reviewed (F9, 2026-06-16); changes below.
//
// ⚠️ OMAR FINAL-REVIEW REQUESTED for SOLD_TRANSFERRED (see comment inline).
// All other strings confirmed as standard Saudi PropTech usage.

export const MARKETPLACE_LISTING_STATUS_LABEL = {
  DRAFT:            { ar: "مسودة",          en: "Draft" },
  PUBLISHED:        { ar: "منشور",           en: "Published" },
  // "تحت العقد" is the standard Saudi RE term for a listing under a binding
  // purchase contract (pre-transfer). Confirmed correct.
  UNDER_CONTRACT:   { ar: "تحت العقد",       en: "Under Contract" },
  // ⚠️ OMAR: changed from "مُنقَّل" (unusual shadda form) to "نُقلت الملكية"
  // (standard Saudi deed-transfer phrasing used in Ejar/REGA docs).
  // Alternative: "منقولة الملكية". Please confirm which matches your audience.
  SOLD_TRANSFERRED: { ar: "نُقلت الملكية",   en: "Transferred" },
  // "غير منشور" is the natural antonym of "منشور" in platform Arabic. Confirmed.
  UNPUBLISHED:      { ar: "غير منشور",       en: "Unpublished" },
  EXPIRED:          { ar: "منتهي",           en: "Expired" },
  // "مرفوض" is standard for a moderation-rejected listing. Confirmed.
  REJECTED:         { ar: "مرفوض",           en: "Rejected" },
  // "موقوف" is the correct term for an admin-suspended listing. Confirmed.
  SUSPENDED:        { ar: "موقوف",           en: "Suspended" },
} satisfies Record<MarketplaceListingStatus, { ar: string; en: string }> as Record<
  string,
  { ar: string; en: string }
>;

export const MARKETPLACE_LISTING_STATUS_VARIANT = {
  DRAFT: "default",
  PUBLISHED: "success",
  UNDER_CONTRACT: "info",
  SOLD_TRANSFERRED: "sold",
  UNPUBLISHED: "warning",
  EXPIRED: "error",
  REJECTED: "error",  // added — not in original page map; same tone as SUSPENDED
  SUSPENDED: "error",
} satisfies Record<MarketplaceListingStatus, BadgeVariant> as Record<string, BadgeVariant>;
