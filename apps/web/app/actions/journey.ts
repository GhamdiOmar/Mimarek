"use server";

/**
 * journey.ts — Cross-record journey data layer (Phase 4 sequential gate).
 *
 * Exports a single Server Action: `getJourneySummary`.
 * Auth / org-resolution pattern mirrors `contracts.ts` (requirePermission +
 * org-filter on every Prisma query). Decimal serialization via the shared
 * `serialize()` seam (lib/serialize.ts) per project convention.
 *
 * Stages, blocker ids, and next-action hrefs are grounded on the real state
 * machines in contracts.ts / maintenance.ts / customer-interests.ts /
 * reservations.ts — no invented vocabulary.
 */

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";
import { serialize } from "../../lib/serialize";
import type {
  JourneySummary,
  ProcessStage,
  ProcessBlocker,
  NextBestAction,
  RelatedRecordSummary,
  LocalizedText,
} from "@repo/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loc(en: string, ar: string): LocalizedText {
  return { en, ar };
}

/** Days elapsed since a date. */
function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

/** ISO yyyy-mm-dd string from a Date. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns a fully-assembled JourneySummary for the requested entity, or
 * null if the record doesn't exist or belongs to a different org.
 *
 * Auth uses `requirePermission` identical to every other read action in this
 * codebase. The permission chosen is the most narrow read scope that still
 * covers all data assembled for that entity type.
 */
// eslint-disable-next-line mimaric/require-action-guard -- the guard lives in each delegated build*Journey() (e.g. requirePermission("contracts:read") + org-scoping); this dispatcher has no direct DB access.
export async function getJourneySummary(
  entityType: "contract" | "reservation" | "customer" | "unit" | "maintenance",
  id: string,
): Promise<JourneySummary | null> {
  switch (entityType) {
    case "contract":
      return buildContractJourney(id);
    case "reservation":
      return buildReservationJourney(id);
    case "customer":
      return buildCustomerJourney(id);
    case "unit":
      return buildUnitJourney(id);
    case "maintenance":
      return buildMaintenanceJourney(id);
    default:
      return null;
  }
}

// ─── Contract Journey ─────────────────────────────────────────────────────────
//
// State machine (contracts.ts VALID_TRANSITIONS):
//   DRAFT → SENT → SIGNED → VOID   (CANCELLED terminal from DRAFT/SENT)
// Linear display order for the rail: DRAFT → SENT → SIGNED
// VOID / CANCELLED are terminal "off-rail" states — when current, every prior
// stage is marked done and the current stage id is set to the actual status.

const CONTRACT_RAIL_ORDER = ["DRAFT", "SENT", "SIGNED"] as const;
type ContractStatus = "DRAFT" | "SENT" | "SIGNED" | "VOID" | "CANCELLED";

const CONTRACT_STAGE_LABEL: Record<string, LocalizedText> = {
  DRAFT: loc("Draft", "مسودة"),
  SENT: loc("Sent", "مُرسَل"),
  SIGNED: loc("Signed", "موقَّع"),
  VOID: loc("Void", "ملغى"),
  CANCELLED: loc("Cancelled", "مُلغى"),
};

async function buildContractJourney(id: string): Promise<JourneySummary | null> {
  const session = await requirePermission("contracts:read");

  const contract = await db.contract.findFirst({
    where: { id, customer: { organizationId: session.organizationId } },
    include: {
      customer: { select: { id: true, name: true } },
      unit: { select: { id: true, number: true, type: true } },
      lease: { select: { id: true, status: true } },
    },
  });
  if (!contract) return null;

  const status = contract.status as ContractStatus;
  const isTerminal = status === "VOID" || status === "CANCELLED";

  // Build stage rail
  const stages: ProcessStage[] = CONTRACT_RAIL_ORDER.map((s) => {
    const railIdx = CONTRACT_RAIL_ORDER.indexOf(s);
    const currentIdx = CONTRACT_RAIL_ORDER.indexOf(
      isTerminal ? "SIGNED" : (status as (typeof CONTRACT_RAIL_ORDER)[number]),
    );

    let stageStatus: ProcessStage["status"];
    if (isTerminal || railIdx < currentIdx) {
      stageStatus = "done";
    } else if (!isTerminal && s === status) {
      stageStatus = "current";
    } else {
      stageStatus = "upcoming";
    }

    return { id: s, label: CONTRACT_STAGE_LABEL[s]!, status: stageStatus };
  });

  // Append terminal node when voided / cancelled
  if (isTerminal) {
    stages.push({
      id: status,
      label: CONTRACT_STAGE_LABEL[status]!,
      status: "current",
    });
  }

  // Blockers
  const blockers: ProcessBlocker[] = [];

  // SENT but unsigned for > 7 days → warning; > 14 days → error
  if (status === "SENT") {
    const daysWaiting = daysSince(contract.updatedAt);
    if (daysWaiting >= 7) {
      blockers.push({
        id: "contract-unsigned-overdue",
        severity: daysWaiting >= 14 ? "error" : "warning",
        title: loc("Contract awaiting signature", "العقد بانتظار التوقيع"),
        detail: loc(
          `Sent ${daysWaiting} day${daysWaiting === 1 ? "" : "s"} ago — follow up with the customer.`,
          `تم الإرسال منذ ${daysWaiting} ${daysWaiting === 1 ? "يوم" : "أيام"} — تابع مع العميل.`,
        ),
        actionLabel: loc("View customer", "عرض العميل"),
        actionHref: `/dashboard/crm`,
      });
    }
  }

  // DRAFT with no file attached → warning
  if (status === "DRAFT" && !contract.fileUrl) {
    blockers.push({
      id: "contract-no-document",
      severity: "warning",
      title: loc("No document attached", "لا يوجد مستند مرفق"),
      detail: loc(
        "Upload the signed PDF before sending this contract.",
        "ارفع ملف PDF قبل إرسال العقد.",
      ),
      actionLabel: loc("Upload document", "رفع مستند"),
      actionHref: `/dashboard/contracts`,
    });
  }

  // Next actions
  const nextActions: NextBestAction[] = [];

  if (status === "DRAFT") {
    nextActions.push({
      label: loc("Send to customer", "إرسال للعميل"),
      href: `/dashboard/contracts`,
      primary: true,
      owner: loc("Agent", "الوكيل"),
    });
    nextActions.push({
      label: loc("Upload document", "رفع مستند"),
      href: `/dashboard/contracts`,
      primary: false,
    });
  } else if (status === "SENT") {
    nextActions.push({
      label: loc("Mark as signed", "تسجيل التوقيع"),
      href: `/dashboard/contracts`,
      primary: true,
      owner: loc("Agent", "الوكيل"),
      dueDate: isoDate(new Date(contract.updatedAt.getTime() + 14 * 86_400_000)),
    });
    nextActions.push({
      label: loc("Follow up with customer", "متابعة مع العميل"),
      href: `/dashboard/crm`,
      primary: false,
    });
  } else if (status === "SIGNED") {
    nextActions.push({
      label: loc("View contract details", "عرض تفاصيل العقد"),
      href: `/dashboard/contracts`,
      primary: true,
    });
  } else {
    nextActions.push({
      label: loc("Create new contract", "إنشاء عقد جديد"),
      href: `/dashboard/contracts`,
      primary: true,
    });
  }

  // Related records
  const related: RelatedRecordSummary[] = [];

  if (contract.customer) {
    related.push({
      kind: "customer",
      id: contract.customer.id,
      label: loc(contract.customer.name, contract.customer.name),
      href: `/dashboard/crm`,
      meta: loc("Customer", "العميل"),
    });
  }

  if (contract.unit) {
    related.push({
      kind: "unit",
      id: contract.unit.id,
      label: loc(
        `Unit ${contract.unit.number}`,
        `وحدة ${contract.unit.number}`,
      ),
      href: `/dashboard/units`,
      meta: loc(contract.unit.type, contract.unit.type),
    });
  }

  // Most recent invoices linked via lease installments (up to 3)
  if (contract.lease) {
    const installments = await db.rentInstallment.findMany({
      where: { leaseId: contract.lease.id },
      orderBy: { dueDate: "asc" },
      take: 3,
    });
    for (const inst of installments) {
      related.push({
        kind: "invoice",
        id: inst.id,
        label: loc(
          `Installment due ${isoDate(inst.dueDate)}`,
          `قسط بتاريخ ${isoDate(inst.dueDate)}`,
        ),
        href: `/dashboard/finance`,
        meta: loc(inst.status, inst.status),
      });
    }
  }

  // Open maintenance tickets on the same unit (up to 3)
  if (contract.unit) {
    const tickets = await db.maintenanceRequest.findMany({
      where: {
        unitId: contract.unit.id,
        organizationId: session.organizationId,
        status: { notIn: ["RESOLVED", "CLOSED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true, status: true },
    });
    for (const t of tickets) {
      related.push({
        kind: "maintenance",
        id: t.id,
        label: loc(t.title, t.title),
        href: `/dashboard/maintenance/${t.id}`,
        meta: loc(t.status, t.status),
      });
    }
  }

  return serialize({ entity: id, stages, blockers, nextActions, related });
}

// ─── Reservation Journey ──────────────────────────────────────────────────────
//
// Reservation lifecycle (reservations.ts):
//   PENDING → CONFIRMED   (terminal positive)
//   PENDING → CANCELLED   (terminal negative)
//   PENDING → EXPIRED     (terminal negative)
// Rail display order: PENDING → CONFIRMED

type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

const RESERVATION_RAIL_ORDER = ["PENDING", "CONFIRMED"] as const;

const RESERVATION_STAGE_LABEL: Record<string, LocalizedText> = {
  PENDING: loc("Pending", "قيد الانتظار"),
  CONFIRMED: loc("Confirmed", "مؤكَّد"),
  CANCELLED: loc("Cancelled", "مُلغى"),
  EXPIRED: loc("Expired", "منتهي"),
};

async function buildReservationJourney(id: string): Promise<JourneySummary | null> {
  const session = await requirePermission("reservations:read");

  const reservation = await db.reservation.findFirst({
    where: { id, customer: { organizationId: session.organizationId } },
    include: {
      customer: { select: { id: true, name: true } },
      unit: { select: { id: true, number: true, type: true } },
    },
  });
  if (!reservation) return null;

  const status = reservation.status as ReservationStatus;
  const isTerminalNeg = status === "CANCELLED" || status === "EXPIRED";
  const isTerminalPos = status === "CONFIRMED";

  const stages: ProcessStage[] = RESERVATION_RAIL_ORDER.map((s) => {
    let stageStatus: ProcessStage["status"];
    if (isTerminalNeg) {
      // Treat PENDING as done (was reached), CONFIRMED as upcoming (never reached)
      stageStatus = s === "PENDING" ? "done" : "upcoming";
    } else if (isTerminalPos) {
      stageStatus = "done";
    } else {
      // PENDING is current
      stageStatus = s === "PENDING" ? "current" : "upcoming";
    }
    return { id: s, label: RESERVATION_STAGE_LABEL[s]!, status: stageStatus };
  });

  // Append negative terminal stage when applicable
  if (isTerminalNeg) {
    stages.push({
      id: status,
      label: RESERVATION_STAGE_LABEL[status]!,
      status: "current",
    });
  }

  const now = new Date();
  const blockers: ProcessBlocker[] = [];

  // Expired but not yet marked: expiresAt is in the past and still PENDING
  if (status === "PENDING" && reservation.expiresAt < now) {
    blockers.push({
      id: "reservation-past-expiry",
      severity: "error",
      title: loc("Reservation has expired", "انتهت صلاحية الحجز"),
      detail: loc(
        `Expiry was ${isoDate(reservation.expiresAt)} — update or cancel this reservation.`,
        `انتهت الصلاحية في ${isoDate(reservation.expiresAt)} — حدِّث الحجز أو أَلغِه.`,
      ),
      actionLabel: loc("Manage reservation", "إدارة الحجز"),
      actionHref: `/dashboard/reservations`,
    });
  } else if (status === "PENDING") {
    // Warn 3 days before expiry
    const daysLeft = Math.floor((reservation.expiresAt.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft <= 3) {
      blockers.push({
        id: "reservation-expiry-soon",
        severity: "warning",
        title: loc("Reservation expiring soon", "الحجز على وشك الانتهاء"),
        detail: loc(
          `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${isoDate(reservation.expiresAt)}).`,
          `ينتهي خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"} (${isoDate(reservation.expiresAt)}).`,
        ),
        actionLabel: loc("Request extension", "طلب تمديد"),
        actionHref: `/dashboard/reservations`,
      });
    }
  }

  const nextActions: NextBestAction[] = [];
  if (status === "PENDING") {
    nextActions.push({
      label: loc("Confirm reservation", "تأكيد الحجز"),
      href: `/dashboard/reservations`,
      primary: true,
      owner: loc("Agent", "الوكيل"),
      dueDate: isoDate(reservation.expiresAt),
    });
    nextActions.push({
      label: loc("Create contract", "إنشاء عقد"),
      href: `/dashboard/contracts`,
      primary: false,
    });
    nextActions.push({
      label: loc("Cancel reservation", "إلغاء الحجز"),
      href: `/dashboard/reservations`,
      primary: false,
    });
  } else if (isTerminalPos) {
    nextActions.push({
      label: loc("View contract", "عرض العقد"),
      href: `/dashboard/contracts`,
      primary: true,
    });
  } else {
    nextActions.push({
      label: loc("Create new reservation", "إنشاء حجز جديد"),
      href: `/dashboard/reservations`,
      primary: true,
    });
  }

  const related: RelatedRecordSummary[] = [];

  if (reservation.customer) {
    related.push({
      kind: "customer",
      id: reservation.customer.id,
      label: loc(reservation.customer.name, reservation.customer.name),
      href: `/dashboard/crm`,
      meta: loc("Customer", "العميل"),
    });
  }

  if (reservation.unit) {
    related.push({
      kind: "unit",
      id: reservation.unit.id,
      label: loc(`Unit ${reservation.unit.number}`, `وحدة ${reservation.unit.number}`),
      href: `/dashboard/units`,
      meta: loc(reservation.unit.type, reservation.unit.type),
    });
  }

  // Linked contract for same customer + unit
  const contract = await db.contract.findFirst({
    where: {
      customerId: reservation.customerId,
      unitId: reservation.unitId,
      customer: { organizationId: session.organizationId },
      status: { notIn: ["CANCELLED", "VOID"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, contractNumber: true, status: true },
  });
  if (contract) {
    related.push({
      kind: "contract",
      id: contract.id,
      label: loc(contract.contractNumber ?? `Contract`, contract.contractNumber ?? `عقد`),
      href: `/dashboard/contracts`,
      meta: loc(contract.status, contract.status),
    });
  }

  return serialize({ entity: id, stages, blockers, nextActions, related });
}

// ─── Customer Journey ─────────────────────────────────────────────────────────
//
// Customer pipeline = Deal.stage order (customer-interests.ts DEAL_STAGE_ORDER):
//   NEW → QUALIFIED → VIEWING → NEGOTIATION → RESERVED → WON
// LOST is a terminal negative stage.

const CUSTOMER_DEAL_RAIL: string[] = [
  "NEW",
  "QUALIFIED",
  "VIEWING",
  "NEGOTIATION",
  "RESERVED",
  "WON",
];

const CUSTOMER_DEAL_LABEL: Record<string, LocalizedText> = {
  NEW: loc("New", "جديد"),
  QUALIFIED: loc("Qualified", "مؤهَّل"),
  VIEWING: loc("Viewing", "مشاهدة"),
  NEGOTIATION: loc("Negotiation", "تفاوض"),
  RESERVED: loc("Reserved", "محجوز"),
  WON: loc("Won", "مكتمل"),
  LOST: loc("Lost", "خسارة"),
};

async function buildCustomerJourney(id: string): Promise<JourneySummary | null> {
  const session = await requirePermission("crm:read");

  const customer = await db.customer.findFirst({
    where: { id, organizationId: session.organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      propertyInterests: {
        where: { status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          stage: true,
          intent: true,
          value: true,
          expectedCloseDate: true,
          lostReason: true,
          unitId: true,
          unit: { select: { id: true, number: true, type: true } },
        },
      },
    },
  });
  if (!customer) return null;

  // Primary deal drives the rail position
  const primaryDeal = customer.propertyInterests[0] ?? null;
  const currentStage: string = primaryDeal?.stage ?? "NEW";
  const isLost = currentStage === "LOST";

  const currentIdx = CUSTOMER_DEAL_RAIL.indexOf(currentStage);

  const stages: ProcessStage[] = CUSTOMER_DEAL_RAIL.map((s, idx) => {
    let stageStatus: ProcessStage["status"];
    if (isLost) {
      stageStatus = "upcoming"; // entire pipeline stalled
    } else if (idx < currentIdx) {
      stageStatus = "done";
    } else if (s === currentStage) {
      stageStatus = "current";
    } else {
      stageStatus = "upcoming";
    }
    return { id: s, label: CUSTOMER_DEAL_LABEL[s]!, status: stageStatus };
  });

  if (isLost) {
    stages.push({ id: "LOST", label: CUSTOMER_DEAL_LABEL["LOST"]!, status: "current" });
  }

  const blockers: ProcessBlocker[] = [];

  // NEGOTIATION with no expectedCloseDate → warning
  if (
    currentStage === "NEGOTIATION" &&
    primaryDeal &&
    !primaryDeal.expectedCloseDate
  ) {
    blockers.push({
      id: "deal-no-close-date",
      severity: "warning",
      title: loc("No expected close date", "لا يوجد تاريخ إغلاق متوقع"),
      detail: loc(
        "Set an expected close date to track this deal in the pipeline.",
        "حدِّد تاريخ إغلاق متوقعًا لمتابعة هذه الصفقة في المسار.",
      ),
      actionLabel: loc("Update deal", "تحديث الصفقة"),
      actionHref: `/dashboard/crm`,
    });
  }

  // NEGOTIATION with past expectedCloseDate → error
  if (
    currentStage === "NEGOTIATION" &&
    primaryDeal?.expectedCloseDate &&
    primaryDeal.expectedCloseDate < new Date()
  ) {
    blockers.push({
      id: "deal-close-date-overdue",
      severity: "error",
      title: loc("Expected close date has passed", "تجاوز تاريخ الإغلاق المتوقع"),
      detail: loc(
        `Expected close was ${isoDate(primaryDeal.expectedCloseDate)} — update or advance the deal.`,
        `كان تاريخ الإغلاق المتوقع ${isoDate(primaryDeal.expectedCloseDate)} — حدِّث الصفقة أو أكمِلها.`,
      ),
      actionLabel: loc("Update deal", "تحديث الصفقة"),
      actionHref: `/dashboard/crm`,
    });
  }

  const nextActions: NextBestAction[] = [];

  const stageActionMap: Record<string, NextBestAction> = {
    NEW: {
      label: loc("Qualify this lead", "تأهيل هذا العميل المحتمل"),
      href: `/dashboard/crm`,
      primary: true,
      owner: loc("Agent", "الوكيل"),
    },
    QUALIFIED: {
      label: loc("Schedule a viewing", "جدولة مشاهدة"),
      href: `/dashboard/crm`,
      primary: true,
      owner: loc("Agent", "الوكيل"),
    },
    VIEWING: {
      label: loc("Move to negotiation", "الانتقال للتفاوض"),
      href: `/dashboard/crm`,
      primary: true,
    },
    NEGOTIATION: {
      label: loc("Create reservation", "إنشاء حجز"),
      href: `/dashboard/reservations`,
      primary: true,
      owner: loc("Agent", "الوكيل"),
      dueDate: primaryDeal?.expectedCloseDate
        ? isoDate(primaryDeal.expectedCloseDate)
        : undefined,
    },
    RESERVED: {
      label: loc("Issue contract", "إصدار عقد"),
      href: `/dashboard/contracts`,
      primary: true,
    },
    WON: {
      label: loc("View contract", "عرض العقد"),
      href: `/dashboard/contracts`,
      primary: true,
    },
    LOST: {
      label: loc("Reactivate lead", "إعادة تفعيل العميل"),
      href: `/dashboard/crm`,
      primary: true,
    },
  };

  const primary = stageActionMap[currentStage];
  if (primary) nextActions.push(primary);

  // Always offer a "View in CRM" secondary
  if (currentStage !== "LOST" && currentStage !== "WON") {
    nextActions.push({
      label: loc("Log interaction", "تسجيل تفاعل"),
      href: `/dashboard/crm`,
      primary: false,
    });
  }

  const related: RelatedRecordSummary[] = [];

  // Linked unit (primary deal)
  if (primaryDeal?.unit) {
    related.push({
      kind: "unit",
      id: primaryDeal.unit.id,
      label: loc(`Unit ${primaryDeal.unit.number}`, `وحدة ${primaryDeal.unit.number}`),
      href: `/dashboard/units`,
      meta: loc(primaryDeal.unit.type, primaryDeal.unit.type),
    });
  }

  // Active reservation for this customer
  const reservation = await db.reservation.findFirst({
    where: {
      customerId: id,
      customer: { organizationId: session.organizationId },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, expiresAt: true },
  });
  if (reservation) {
    related.push({
      kind: "reservation",
      id: reservation.id,
      label: loc("Active reservation", "الحجز النشط"),
      href: `/dashboard/reservations`,
      meta: loc(reservation.status, reservation.status),
    });
  }

  // Most recent contract
  const contract = await db.contract.findFirst({
    where: {
      customerId: id,
      customer: { organizationId: session.organizationId },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, contractNumber: true, status: true },
  });
  if (contract) {
    related.push({
      kind: "contract",
      id: contract.id,
      label: loc(contract.contractNumber ?? "Contract", contract.contractNumber ?? "عقد"),
      href: `/dashboard/contracts`,
      meta: loc(contract.status, contract.status),
    });
  }

  return serialize({ entity: id, stages, blockers, nextActions, related });
}

// ─── Unit Journey ─────────────────────────────────────────────────────────────
//
// Unit status flow (derived from how unit.status is set across all actions):
//   AVAILABLE → RESERVED → RENTED | SOLD → (MAINTENANCE as a parallel flag)
// Rail order: AVAILABLE → RESERVED → RENTED/SOLD
// MAINTENANCE is surfaced as a blocker rather than a stage (it's an
// operational state overlay, not a sequential lifecycle step).

const UNIT_STAGE_LABEL: Record<string, LocalizedText> = {
  AVAILABLE: loc("Available", "متاح"),
  RESERVED: loc("Reserved", "محجوز"),
  RENTED: loc("Rented", "مؤجَّر"),
  SOLD: loc("Sold", "مُباع"),
  MAINTENANCE: loc("Maintenance", "صيانة"),
};

// Canonical three-step rail for sale; lease uses AVAILABLE→RESERVED→RENTED.
// We resolve dynamically from the contract type.
async function buildUnitJourney(id: string): Promise<JourneySummary | null> {
  const session = await requirePermission("properties:read");

  const unit = await db.unit.findFirst({
    where: { id, organizationId: session.organizationId },
    select: {
      id: true,
      number: true,
      type: true,
      status: true,
      markupPrice: true,
      rentalPrice: true,
    },
  });
  if (!unit) return null;

  // Determine lease/sale track from latest signed or active contract
  const latestContract = await db.contract.findFirst({
    where: { unitId: id, customer: { organizationId: session.organizationId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, status: true, contractNumber: true, customerId: true },
  });

  const track = latestContract?.type === "LEASE" ? "LEASE" : "SALE";
  const terminalStage = track === "LEASE" ? "RENTED" : "SOLD";

  const unitRail = ["AVAILABLE", "RESERVED", terminalStage];
  const stageLabelMap: Record<string, LocalizedText> = {
    AVAILABLE: UNIT_STAGE_LABEL["AVAILABLE"]!,
    RESERVED: UNIT_STAGE_LABEL["RESERVED"]!,
    RENTED: UNIT_STAGE_LABEL["RENTED"]!,
    SOLD: UNIT_STAGE_LABEL["SOLD"]!,
  };

  const currentStatus = unit.status as string;
  // Map MAINTENANCE → AVAILABLE for rail positioning (it can occur in any state)
  const railStatus = currentStatus === "MAINTENANCE" ? "AVAILABLE" : currentStatus;
  const currentIdx = unitRail.indexOf(railStatus);

  const stages: ProcessStage[] = unitRail.map((s, idx) => {
    let stageStatus: ProcessStage["status"];
    if (idx < currentIdx) {
      stageStatus = "done";
    } else if (s === railStatus) {
      stageStatus = currentStatus === "MAINTENANCE" ? "blocked" : "current";
    } else {
      stageStatus = "upcoming";
    }
    return { id: s, label: stageLabelMap[s]!, status: stageStatus };
  });

  const blockers: ProcessBlocker[] = [];

  // Open maintenance tickets → determine SLA breach
  const openTickets = await db.maintenanceRequest.findMany({
    where: {
      unitId: id,
      organizationId: session.organizationId,
      status: { notIn: ["RESOLVED", "CLOSED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, dueDate: true, priority: true },
  });

  const overdueTickets = openTickets.filter(
    (t) => t.dueDate && t.dueDate < new Date(),
  );
  const upcomingTickets = openTickets.filter(
    (t) => t.dueDate && t.dueDate >= new Date(),
  );

  if (overdueTickets.length > 0) {
    blockers.push({
      id: "unit-maintenance-overdue",
      severity: "error",
      title: loc(
        `${overdueTickets.length} maintenance ticket${overdueTickets.length > 1 ? "s" : ""} past SLA`,
        `${overdueTickets.length} طلب صيانة ${overdueTickets.length > 1 ? "متأخرة" : "متأخر"} عن الموعد`,
      ),
      detail: loc(
        "SLA breach on open tickets — assign a technician immediately.",
        "تجاوزت طلبات الصيانة المفتوحة الموعد المحدد — عيِّن فنيًا فورًا.",
      ),
      actionLabel: loc("View tickets", "عرض الطلبات"),
      actionHref: `/dashboard/maintenance`,
    });
  } else if (upcomingTickets.length > 0) {
    blockers.push({
      id: "unit-maintenance-open",
      severity: "warning",
      title: loc(
        `${upcomingTickets.length} open maintenance ticket${upcomingTickets.length > 1 ? "s" : ""}`,
        `${upcomingTickets.length} طلب صيانة مفتوح`,
      ),
      detail: loc(
        "Resolve open tickets before listing or reserving this unit.",
        "أَغلق طلبات الصيانة المفتوحة قبل عرض الوحدة أو حجزها.",
      ),
      actionLabel: loc("Manage tickets", "إدارة الطلبات"),
      actionHref: `/dashboard/maintenance`,
    });
  }

  const nextActions: NextBestAction[] = [];

  if (currentStatus === "AVAILABLE") {
    nextActions.push({
      label: loc("Add customer interest", "إضافة اهتمام عميل"),
      href: `/dashboard/crm`,
      primary: true,
      owner: loc("Agent", "الوكيل"),
    });
    nextActions.push({
      label: loc("Create reservation", "إنشاء حجز"),
      href: `/dashboard/reservations`,
      primary: false,
    });
    nextActions.push({
      label: loc("Log maintenance", "تسجيل صيانة"),
      href: `/dashboard/maintenance`,
      primary: false,
    });
  } else if (currentStatus === "RESERVED") {
    nextActions.push({
      label: loc("Issue contract", "إصدار عقد"),
      href: `/dashboard/contracts`,
      primary: true,
    });
    nextActions.push({
      label: loc("View reservation", "عرض الحجز"),
      href: `/dashboard/reservations`,
      primary: false,
    });
  } else if (currentStatus === "SOLD" || currentStatus === "RENTED") {
    nextActions.push({
      label: loc("View contract", "عرض العقد"),
      href: `/dashboard/contracts`,
      primary: true,
    });
    nextActions.push({
      label: loc("Log maintenance", "تسجيل صيانة"),
      href: `/dashboard/maintenance`,
      primary: false,
    });
  } else {
    // MAINTENANCE
    nextActions.push({
      label: loc("View maintenance tickets", "عرض طلبات الصيانة"),
      href: `/dashboard/maintenance`,
      primary: true,
    });
  }

  const related: RelatedRecordSummary[] = [];

  // Interested customers (ACTIVE deals)
  const deals = await db.deal.findMany({
    where: { unitId: id, status: "ACTIVE" },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });
  for (const d of deals) {
    related.push({
      kind: "customer",
      id: d.customer.id,
      label: loc(d.customer.name, d.customer.name),
      href: `/dashboard/crm`,
      meta: loc(`Stage: ${d.stage}`, `المرحلة: ${d.stage}`),
    });
  }

  // Active reservation
  const reservation = await db.reservation.findFirst({
    where: {
      unitId: id,
      customer: { organizationId: session.organizationId },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (reservation) {
    related.push({
      kind: "reservation",
      id: reservation.id,
      label: loc("Active reservation", "الحجز النشط"),
      href: `/dashboard/reservations`,
      meta: loc(reservation.status, reservation.status),
    });
  }

  // Latest contract
  if (latestContract) {
    related.push({
      kind: "contract",
      id: latestContract.id,
      label: loc(
        latestContract.contractNumber ?? "Contract",
        latestContract.contractNumber ?? "عقد",
      ),
      href: `/dashboard/contracts`,
      meta: loc(latestContract.status, latestContract.status),
    });
  }

  // Open maintenance (first 3)
  for (const t of openTickets.slice(0, 3)) {
    related.push({
      kind: "maintenance",
      id: t.id,
      label: loc(t.title, t.title),
      href: `/dashboard/maintenance/${t.id}`,
      meta: loc(t.status, t.status),
    });
  }

  return serialize({ entity: id, stages, blockers, nextActions, related });
}

// ─── Maintenance Journey ──────────────────────────────────────────────────────
//
// State machine (maintenance.ts VALID_TRANSITIONS):
//   OPEN → ASSIGNED → IN_PROGRESS → ON_HOLD → RESOLVED → CLOSED
// SLA due date computed from priority (maintenance.ts computeDueDate):
//   URGENT 2h / HIGH 24h / MEDIUM 72h / LOW 168h

const MAINTENANCE_RAIL_ORDER = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "RESOLVED",
  "CLOSED",
] as const;

const MAINTENANCE_STAGE_LABEL: Record<string, LocalizedText> = {
  OPEN: loc("Open", "مفتوح"),
  ASSIGNED: loc("Assigned", "مُعيَّن"),
  IN_PROGRESS: loc("In progress", "قيد التنفيذ"),
  ON_HOLD: loc("On hold", "معلَّق"),
  RESOLVED: loc("Resolved", "محلول"),
  CLOSED: loc("Closed", "مغلق"),
};

const SLA_HOURS: Record<string, number> = {
  URGENT: 2,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

async function buildMaintenanceJourney(id: string): Promise<JourneySummary | null> {
  const session = await requirePermission("maintenance:read");

  const request = await db.maintenanceRequest.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      unit: { select: { id: true, number: true, type: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  if (!request) return null;

  const status = request.status as string;
  const currentIdx = MAINTENANCE_RAIL_ORDER.indexOf(
    status as (typeof MAINTENANCE_RAIL_ORDER)[number],
  );

  const stages: ProcessStage[] = MAINTENANCE_RAIL_ORDER.map((s, idx) => {
    let stageStatus: ProcessStage["status"];
    if (idx < currentIdx) {
      stageStatus = "done";
    } else if (s === status) {
      stageStatus = "current";
    } else {
      stageStatus = "upcoming";
    }

    // ON_HOLD is a valid regression state; mark upcoming stages as blocked
    // when the request is currently on hold.
    if (status === "ON_HOLD" && idx > currentIdx) {
      stageStatus = "blocked";
    }

    return { id: s, label: MAINTENANCE_STAGE_LABEL[s]!, status: stageStatus };
  });

  const blockers: ProcessBlocker[] = [];
  const now = new Date();

  // SLA breach — dueDate in past for non-terminal tickets
  if (
    !["RESOLVED", "CLOSED"].includes(status) &&
    request.dueDate &&
    request.dueDate < now
  ) {
    const hoursOverdue = Math.round(
      (now.getTime() - request.dueDate.getTime()) / 3_600_000,
    );
    blockers.push({
      id: "maintenance-sla-breached",
      severity: "error",
      title: loc("SLA breached", "تجاوز اتفاقية مستوى الخدمة"),
      detail: loc(
        `Ticket is ${hoursOverdue}h past the ${request.priority} SLA (${SLA_HOURS[request.priority] ?? 72}h). Escalate immediately.`,
        `تأخر الطلب ${hoursOverdue} ساعة عن سياسة ${request.priority} (${SLA_HOURS[request.priority] ?? 72} ساعة). تصعيد فوري مطلوب.`,
      ),
      actionLabel: loc("Assign technician", "تعيين فني"),
      actionHref: `/dashboard/maintenance/${id}`,
    });
  }

  // OPEN with no assignee → warning
  if (status === "OPEN" && !request.assignedToId) {
    blockers.push({
      id: "maintenance-unassigned",
      severity: "warning",
      title: loc("Not yet assigned", "لم يُعيَّن بعد"),
      detail: loc(
        "Assign a technician to start the clock on this request.",
        "عيِّن فنيًا لبدء احتساب الوقت على هذا الطلب.",
      ),
      actionLabel: loc("Assign technician", "تعيين فني"),
      actionHref: `/dashboard/maintenance/${id}`,
    });
  }

  // ON_HOLD — forward progress is blocked
  if (status === "ON_HOLD") {
    blockers.push({
      id: "maintenance-on-hold",
      severity: "warning",
      title: loc("Ticket is on hold", "الطلب معلَّق"),
      detail: loc(
        "This request is paused. Resume work or close the ticket.",
        "هذا الطلب موقوف. استأنف العمل أو أغلق الطلب.",
      ),
      actionLabel: loc("Resume work", "استئناف العمل"),
      actionHref: `/dashboard/maintenance/${id}`,
    });
  }

  const nextActions: NextBestAction[] = [];

  const maintenanceNextAction: Record<string, NextBestAction> = {
    OPEN: {
      label: loc("Assign a technician", "تعيين فني"),
      href: `/dashboard/maintenance/${id}`,
      primary: true,
      owner: loc("Manager", "المدير"),
      dueDate: request.dueDate ? isoDate(request.dueDate) : undefined,
    },
    ASSIGNED: {
      label: loc("Start work", "بدء العمل"),
      href: `/dashboard/maintenance/${id}`,
      primary: true,
      owner: request.assignedTo
        ? loc(request.assignedTo.name ?? "Technician", request.assignedTo.name ?? "الفني")
        : loc("Technician", "الفني"),
      dueDate: request.dueDate ? isoDate(request.dueDate) : undefined,
    },
    IN_PROGRESS: {
      label: loc("Mark as resolved", "تسجيل الحل"),
      href: `/dashboard/maintenance/${id}`,
      primary: true,
      owner: request.assignedTo
        ? loc(request.assignedTo.name ?? "Technician", request.assignedTo.name ?? "الفني")
        : loc("Technician", "الفني"),
    },
    ON_HOLD: {
      label: loc("Resume work", "استئناف العمل"),
      href: `/dashboard/maintenance/${id}`,
      primary: true,
    },
    RESOLVED: {
      label: loc("Close ticket", "إغلاق الطلب"),
      href: `/dashboard/maintenance/${id}`,
      primary: true,
      owner: loc("Manager", "المدير"),
    },
    CLOSED: {
      label: loc("View ticket details", "عرض تفاصيل الطلب"),
      href: `/dashboard/maintenance/${id}`,
      primary: true,
    },
  };

  const primary = maintenanceNextAction[status];
  if (primary) nextActions.push(primary);

  // Secondary: view unit
  if (request.unit) {
    nextActions.push({
      label: loc("View unit", "عرض الوحدة"),
      href: `/dashboard/units`,
      primary: false,
    });
  }

  const related: RelatedRecordSummary[] = [];

  if (request.unit) {
    related.push({
      kind: "unit",
      id: request.unit.id,
      label: loc(`Unit ${request.unit.number}`, `وحدة ${request.unit.number}`),
      href: `/dashboard/units`,
      meta: loc(request.unit.type, request.unit.type),
    });
  }

  // Other open tickets on the same unit
  const sibling = await db.maintenanceRequest.findMany({
    where: {
      unitId: request.unitId,
      organizationId: session.organizationId,
      id: { not: id },
      status: { notIn: ["RESOLVED", "CLOSED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, status: true },
  });
  for (const t of sibling) {
    related.push({
      kind: "maintenance",
      id: t.id,
      label: loc(t.title, t.title),
      href: `/dashboard/maintenance/${t.id}`,
      meta: loc(t.status, t.status),
    });
  }

  // Active contract / lease for this unit
  const contract = await db.contract.findFirst({
    where: {
      unitId: request.unitId,
      customer: { organizationId: session.organizationId },
      status: { notIn: ["CANCELLED", "VOID"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, contractNumber: true, status: true, customerId: true },
  });
  if (contract) {
    related.push({
      kind: "contract",
      id: contract.id,
      label: loc(
        contract.contractNumber ?? "Contract",
        contract.contractNumber ?? "عقد",
      ),
      href: `/dashboard/contracts`,
      meta: loc(contract.status, contract.status),
    });

    // Customer on the contract
    const customer = await db.customer.findFirst({
      where: { id: contract.customerId, organizationId: session.organizationId },
      select: { id: true, name: true },
    });
    if (customer) {
      related.push({
        kind: "customer",
        id: customer.id,
        label: loc(customer.name, customer.name),
        href: `/dashboard/crm`,
        meta: loc("Tenant / Owner", "المستأجر / المالك"),
      });
    }
  }

  return serialize({ entity: id, stages, blockers, nextActions, related });
}
