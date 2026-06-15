import "server-only";

import { db, CustomerStatus, DealStage } from "@repo/db";

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
// already org-guarded server actions). Lives in a `server-only` module (NOT a
// "use server" file) so it is NOT exposed as a network-reachable RPC (QA-SEC-01).
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
// already org-guarded server actions); does NOT touch tenancy statuses. Lives in
// a `server-only` module (NOT a "use server" file) so it is NOT exposed as a
// network-reachable RPC (QA-SEC-01).
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
