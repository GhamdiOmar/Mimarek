/**
 * Marketplace listing + cross-org transfer state machines.
 *
 * Mirrors `lib/units/state-machine.ts` / `lib/contracts/state-machine.ts`:
 * a pure transition table + a validator, plus an atomic `transitionTransfer`
 * CAS helper for the irreversible conveyance rail.
 *
 * NOT a "use server" file — these are pure helpers + a tx-scoped CAS, imported
 * by the marketplace server actions. Same-status writes (from === to) are
 * no-ops and ALLOWED (callers may short-circuit before validation).
 */
import type { db } from "@repo/db";

/**
 * Listing lifecycle.
 *
 *   DRAFT            → PENDING_REVIEW | UNPUBLISHED
 *   PENDING_REVIEW   → PUBLISHED | REJECTED        (platform moderation)
 *   REJECTED         → PENDING_REVIEW              (seller re-submits)
 *   PUBLISHED        → UNDER_CONTRACT | UNPUBLISHED | EXPIRED | SUSPENDED
 *   UNDER_CONTRACT   → SOLD_TRANSFERRED | PUBLISHED
 *   SUSPENDED        → PENDING_REVIEW
 *   UNPUBLISHED      → PENDING_REVIEW
 *   EXPIRED          → PENDING_REVIEW
 *   SOLD_TRANSFERRED → (terminal)
 *
 * A seller can NEVER self-publish: DRAFT/UNPUBLISHED/etc. all route through
 * PENDING_REVIEW, and only platform moderation can take PENDING_REVIEW →
 * PUBLISHED.
 */
export const LISTING_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_REVIEW", "UNPUBLISHED"],
  PENDING_REVIEW: ["PUBLISHED", "REJECTED"],
  REJECTED: ["PENDING_REVIEW"],
  PUBLISHED: ["UNDER_CONTRACT", "UNPUBLISHED", "EXPIRED", "SUSPENDED"],
  UNDER_CONTRACT: ["SOLD_TRANSFERRED", "PUBLISHED"],
  SUSPENDED: ["PENDING_REVIEW"],
  UNPUBLISHED: ["PENDING_REVIEW"],
  EXPIRED: ["PENDING_REVIEW"],
  SOLD_TRANSFERRED: [],
};

/**
 * Cross-org unit-transfer lifecycle.
 *
 *   PENDING_SETTLEMENT → READY | CANCELLED | FAILED
 *   READY              → COMPLETED | FAILED | CANCELLED
 *   COMPLETED          → (terminal)
 *   FAILED             → (terminal)
 *   CANCELLED          → (terminal)
 *
 * PENDING_SETTLEMENT → READY happens when a staff member VERIFIES the deed
 * proof. READY → COMPLETED is the irreversible settlement (gated by the
 * conveyance flag + both-orgs-REGA-verified + a SIGNED sale contract).
 */
export const TRANSFER_TRANSITIONS: Record<string, string[]> = {
  PENDING_SETTLEMENT: ["READY", "CANCELLED", "FAILED"],
  READY: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

/**
 * True when the listing transition is permitted. Same-status (from === to) is
 * treated as a no-op and returns true.
 */
export function isValidListingTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return (LISTING_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * True when the transfer transition is permitted. Same-status (from === to) is
 * treated as a no-op and returns true.
 */
export function isValidTransferTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return (TRANSFER_TRANSITIONS[from] ?? []).includes(to);
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Atomically transition a UnitTransferTransaction `from` → `to` inside a
 * transaction. Validates the transition, then does a CAS
 * (`updateMany where: { id, status: from }`). If the CAS claims 0 rows, it
 * re-reads the row: if it's already in the target `to` state the call is
 * idempotent (returns the row); otherwise the row moved out from under us and
 * we throw. Returns the updated/current transfer row.
 */
export async function transitionTransfer(
  tx: Tx,
  id: string,
  from: string,
  to: string,
  data: Record<string, unknown> = {},
) {
  if (!isValidTransferTransition(from, to)) {
    throw new Error(`Illegal transfer transition ${from} → ${to}.`);
  }

  const claim = await tx.unitTransferTransaction.updateMany({
    where: { id, status: from as never },
    data: { status: to as never, ...data },
  });

  if (claim.count === 0) {
    const current = await tx.unitTransferTransaction.findUnique({ where: { id } });
    // Idempotent: already in the target state → treat as success.
    if (current && current.status === to) return current;
    throw new Error(`Transfer no longer in ${from}.`);
  }

  return tx.unitTransferTransaction.findUniqueOrThrow({ where: { id } });
}
