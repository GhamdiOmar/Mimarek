"use server";

import { db, CustomerStatus, DealStage } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission, getSessionWithPermissions } from "../../lib/auth-helpers";
import { decryptCustomerData } from "../../lib/pii-crypto";
import { maskCustomerPii } from "../../lib/pii-masking";
import { logAuditEvent } from "../../lib/audit";
import { createReservation } from "./reservations";
import { updateCustomerStatus } from "./customers";

// Most-advanced-first ordering for the deal pipeline. Index = advancement rank.
const DEAL_STAGE_ORDER: DealStage[] = [
  "NEW",
  "QUALIFIED",
  "VIEWING",
  "NEGOTIATION",
  "RESERVED",
  "WON",
];

// Deal.stage → derived Customer.status (pipeline statuses only; tenancy wins elsewhere)
const STAGE_TO_CUSTOMER_STATUS: Record<DealStage, CustomerStatus> = {
  NEW: "NEW",
  QUALIFIED: "QUALIFIED",
  VIEWING: "VIEWING",
  NEGOTIATION: "NEGOTIATION",
  RESERVED: "RESERVED",
  WON: "CONVERTED",
  LOST: "LOST",
};

// ─── Sync Customer.status from the customer's deals (derived cache — R3) ───────
// `Customer.status` is no longer the writer of record for pipeline state. It is
// recomputed from the customer's Deal rows. Tenancy lifecycle statuses
// (ACTIVE_TENANT / PAST_TENANT) are owned by contracts/leases and win over the
// derived pipeline value — when the customer is in a tenancy state we return
// without touching it. Internal helper (no own permission gate — callers are
// already org-guarded server actions).
export async function syncCustomerPipelineStatus(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, status: true },
  });
  if (!customer) return;

  // Tenancy lifecycle wins — never override it with a derived pipeline status.
  if (customer.status === "ACTIVE_TENANT" || customer.status === "PAST_TENANT") {
    return;
  }

  const deals = await db.deal.findMany({
    where: { customerId },
    select: { id: true, status: true, stage: true, updatedAt: true },
  });

  const activeDeals = deals.filter((d) => d.status === "ACTIVE");

  let nextStatus: CustomerStatus | null = null;

  if (activeDeals.length > 0) {
    // Pick the most-advanced ACTIVE deal; deterministic tie-break by
    // most-advanced stage, then most-recent updatedAt.
    const best = [...activeDeals].sort((a, b) => {
      const rankA = DEAL_STAGE_ORDER.indexOf(a.stage);
      const rankB = DEAL_STAGE_ORDER.indexOf(b.stage);
      if (rankB !== rankA) return rankB - rankA; // higher rank first
      return b.updatedAt.getTime() - a.updatedAt.getTime(); // most recent first
    })[0]!; // activeDeals.length > 0 guaranteed by the branch guard above
    nextStatus = STAGE_TO_CUSTOMER_STATUS[best.stage];
  } else if (
    deals.length > 0 &&
    deals.some((d) => d.stage === "LOST" || d.status === "DROPPED")
  ) {
    // No ACTIVE deals and at least one LOST/dropped, none other → LOST.
    nextStatus = "LOST";
  }

  if (nextStatus && nextStatus !== customer.status) {
    await db.customer.update({
      where: { id: customerId },
      data: { status: nextStatus },
    });
  }
}

// ─── Reroute a pipeline status change through the Deal entity ─────────────────
// Used by reservation/contract actions instead of writing Customer.status
// directly (R3 — Customer.status is a derived cache, Deal.stage is the writer
// of record). Finds the live ACTIVE deal for this customer+unit and sets its
// stage; if none exists (e.g. a reservation created directly without a prior
// interest) a deal is materialized at the target stage so the pipeline stays
// the single source of truth and the customer status does not silently regress.
// Then recomputes Customer.status from all deals. Internal helper (callers are
// already org-guarded server actions); does NOT touch tenancy statuses.
export async function syncDealStageForUnit(
  customerId: string,
  unitId: string,
  stage: DealStage,
  opts?: { intent?: "BUY" | "RENT"; lostReason?: string }
) {
  const existing = await db.deal.findFirst({
    where: { customerId, unitId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    await db.deal.update({
      where: { id: existing.id },
      data: {
        stage,
        ...(stage === "LOST" && opts?.lostReason !== undefined
          ? { lostReason: opts.lostReason }
          : {}),
      },
    });
  } else {
    await db.deal.create({
      data: {
        customerId,
        unitId,
        intent: opts?.intent ?? "BUY",
        status: "ACTIVE",
        stage,
        ...(stage === "LOST" && opts?.lostReason !== undefined
          ? { lostReason: opts.lostReason }
          : {}),
      },
    });
  }

  await syncCustomerPipelineStatus(customerId);
}

// ─── Add a property interest (Deal) for a customer ────────────────────────────
export async function addCustomerInterest(
  customerId: string,
  unitId: string,
  intent: "BUY" | "RENT"
) {
  const session = await requirePermission("crm:write");

  // Verify customer belongs to org
  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
  });
  if (!customer) throw new Error("Customer not found or you don't have access. Please verify the customer exists in your organization.");

  // Verify unit belongs to org
  const unit = await db.unit.findFirst({
    where: { id: unitId, organizationId: session.organizationId },
  });
  if (!unit) throw new Error("Property not found or you don't have access. Please verify the property exists in your organization.");

  // Create-or-reactivate. The old compound unique (customerId, unitId) no longer
  // exists (a customer may now have multiple deals on a unit over time — R1/R2),
  // so we find the live ACTIVE deal and update it, otherwise create a new one.
  const existing = await db.deal.findFirst({
    where: { customerId, unitId, status: "ACTIVE" },
  });

  const interest = existing
    ? await db.deal.update({
        where: { id: existing.id },
        data: { intent, status: "ACTIVE" },
      })
    : await db.deal.create({
        data: { customerId, unitId, intent, status: "ACTIVE", stage: "NEW" },
      });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "CustomerPropertyInterest",
    resourceId: interest.id,
    metadata: { customerId, unitId, intent },
    organizationId: session.organizationId,
  });

  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/units");
  return JSON.parse(JSON.stringify(interest));
}

// ─── Drop a property interest (no unit status change) ─────────────────────────
export async function dropCustomerInterest(interestId: string) {
  const session = await requirePermission("crm:write");

  const interest = await db.deal.findFirst({
    where: { id: interestId },
    include: { customer: { select: { organizationId: true } } },
  });
  if (!interest || interest.customer.organizationId !== session.organizationId) {
    throw new Error("Interest record not found or you don't have access. Please refresh the page.");
  }

  const updated = await db.deal.update({
    where: { id: interestId },
    data: { status: "DROPPED" },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "CustomerPropertyInterest",
    resourceId: interestId,
    metadata: { status: "DROPPED" },
    organizationId: session.organizationId,
  });

  // Customer.status is a derived cache — recompute after dropping a deal.
  await syncCustomerPipelineStatus(interest.customerId);

  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/units");
  return JSON.parse(JSON.stringify(updated));
}

// ─── Update a Deal's pipeline stage ───────────────────────────────────────────
export async function updateDealStage(dealId: string, stage: DealStage, lostReason?: string) {
  const session = await requirePermission("crm:write");

  const deal = await db.deal.findFirst({
    where: { id: dealId },
    include: { customer: { select: { id: true, organizationId: true } } },
  });
  if (!deal || deal.customer.organizationId !== session.organizationId) {
    throw new Error("Deal not found or you don't have access. Please refresh the page.");
  }

  const updated = await db.deal.update({
    where: { id: dealId },
    data: {
      stage,
      ...(stage === "LOST" ? { lostReason: lostReason ?? null } : {}),
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "CustomerPropertyInterest",
    resourceId: dealId,
    metadata: { stage, ...(stage === "LOST" ? { lostReason } : {}) },
    organizationId: session.organizationId,
  });

  // Customer.status is now derived from the deal pipeline.
  await syncCustomerPipelineStatus(deal.customerId);

  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/reservations");
  return JSON.parse(JSON.stringify(updated));
}

// Kanban column key → DealStage. Columns with no deal-stage equivalent
// (e.g. CONTACTED) are absent — those fall back to the manual Customer.status
// setter so the un-restructured 5-column board keeps working for leads with no
// linked deal yet.
const KANBAN_STAGE_TO_DEAL_STAGE: Record<string, DealStage | undefined> = {
  NEW: "NEW",
  CONTACTED: undefined,
  QUALIFIED: "QUALIFIED",
  VIEWING: "VIEWING",
  NEGOTIATION: "NEGOTIATION",
  RESERVED: "RESERVED",
  CONVERTED: "WON",
  LOST: "LOST",
};

// ─── CRM board bridge: move a customer's primary deal through the pipeline ─────
// The Kanban cards are customers (no UI restructure — § 5). Resolve the
// customer's most-recent ACTIVE deal and stage it (Customer.status is then
// derived — R3). If the customer has no active deal, or the target column has
// no DealStage equivalent (e.g. CONTACTED), fall back to the manual
// Customer.status setter — the same direct/manual override the spec preserves —
// so dragging an un-linked lead still works (no regression).
export async function setCustomerPipelineStage(
  customerId: string,
  kanbanStage: string,
  lostReason?: string
) {
  const session = await requirePermission("crm:write");

  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!customer) {
    throw new Error("Customer not found or you don't have access. Please refresh the page.");
  }

  const targetDealStage = KANBAN_STAGE_TO_DEAL_STAGE[kanbanStage];

  const primaryDeal = targetDealStage
    ? await db.deal.findFirst({
        where: { customerId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      })
    : null;

  if (targetDealStage && primaryDeal) {
    return updateDealStage(primaryDeal.id, targetDealStage, lostReason);
  }

  // Fallback: no stageable deal — manual Customer.status write (preserved
  // manual-override path; mirrors updateCustomerStatus semantics incl. LOST).
  return updateCustomerStatus(customerId, kanbanStage, lostReason);
}

// ─── Convert an interest to a Deal (reservation) ──────────────────────────────
export async function convertInterestToDeal(
  interestId: string,
  data: { amount: number; expiresAt: Date; depositAmount?: number }
) {
  const session = await requirePermission("deals:write");

  const interest = await db.deal.findFirst({
    where: { id: interestId },
    include: {
      customer: { select: { id: true, organizationId: true } },
      unit: { select: { id: true, organizationId: true } },
    },
  });
  if (!interest || interest.customer.organizationId !== session.organizationId) {
    throw new Error("Interest record not found or you don't have access. Please refresh the page.");
  }
  if (interest.status !== "ACTIVE") {
    throw new Error("This interest has already been converted or dropped. Please refresh the page.");
  }

  // Create the reservation (this handles Unit→RESERVED).
  const reservation = await createReservation({
    customerId: interest.customerId,
    unitId: interest.unitId,
    amount: data.amount,
    expiresAt: data.expiresAt,
    depositAmount: data.depositAmount,
  });

  // Mark interest as CONVERTED and advance the deal to RESERVED.
  await db.deal.update({
    where: { id: interestId },
    data: { status: "CONVERTED", stage: "RESERVED" },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "CustomerPropertyInterest",
    resourceId: interestId,
    metadata: { status: "CONVERTED", stage: "RESERVED", reservationId: reservation.id },
    organizationId: session.organizationId,
  });

  // Customer.status is derived — recompute from deals (createReservation no
  // longer writes Customer.status directly).
  await syncCustomerPipelineStatus(interest.customerId);

  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/units");
  return JSON.parse(JSON.stringify(reservation));
}

// ─── Get all interests for a customer ─────────────────────────────────────────
export async function getCustomerInterests(customerId: string) {
  const session = await requirePermission("crm:read");

  // Verify customer belongs to org
  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found or you don't have access.");

  const interests = await db.deal.findMany({
    where: { customerId },
    include: {
      unit: {
        select: {
          id: true,
          number: true,
          type: true,
          city: true,
          district: true,
          buildingName: true,
          markupPrice: true,
          rentalPrice: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return JSON.parse(JSON.stringify(interests));
}

// ─── Get all customers interested in a specific unit ──────────────────────────
export async function getCustomerInterestsForUnit(unitId: string) {
  const session = await getSessionWithPermissions();

  if (!session.can("properties:read")) {
    throw new Error("Forbidden: you do not have permission to read properties.");
  }

  const hasPii = session.can("customers:read_pii");

  // Verify unit belongs to org
  const unit = await db.unit.findFirst({
    where: { id: unitId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!unit) throw new Error("Property not found or you don't have access.");

  const interests = await db.deal.findMany({
    where: { unitId, status: "ACTIVE" },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          agentId: true,
          agent: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (hasPii) {
    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "READ_PII",
      resource: "CustomerPropertyInterest",
      metadata: { unitId, count: interests.length },
      organizationId: session.organizationId,
    });
  }

  const maskedInterests = interests.map((interest) => {
    const decrypted = decryptCustomerData({ phone: interest.customer.phone });
    const masked = maskCustomerPii(
      { phone: decrypted.phone, phoneHash: undefined },
      hasPii
    );
    return {
      ...interest,
      customer: {
        ...interest.customer,
        phone: masked.phone,
      },
    };
  });

  return JSON.parse(JSON.stringify(maskedInterests));
}

// ─── Get available units for interest linking (org-scoped) ────────────────────
export async function getAvailableUnitsForInterest() {
  const session = await requirePermission("crm:read");

  const units = await db.unit.findMany({
    where: {
      organizationId: session.organizationId,
      status: { in: ["AVAILABLE", "RESERVED"] },
    },
    select: {
      id: true,
      number: true,
      type: true,
      city: true,
      district: true,
      buildingName: true,
      markupPrice: true,
      rentalPrice: true,
      status: true,
      bedrooms: true,
      bathrooms: true,
      area: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return JSON.parse(JSON.stringify(units));
}
