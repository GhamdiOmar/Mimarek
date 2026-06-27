import "server-only";

import { db } from "@repo/db";

/**
 * Flip past-due rent installments to OVERDUE — across ALL organizations.
 *
 * Server-only batch helper: invoked ONLY by the cron route
 * `/api/cron/mark-overdue-installments` (CRON_SECRET-gated). It is NOT a
 * `"use server"` action — keeping it out of `app/actions/**` means it is not a
 * network-reachable RPC. Takes no caller-supplied input and mutates only
 * globally-overdue rows.
 *
 * This is the production writer of `RentInstallment.status="OVERDUE"`. Before it
 * was wired to a cron, installments never transitioned to OVERDUE in production
 * (the org-scoped `markOverdueInstallments` action had no caller). The
 * `scripts/check-cron-coverage.mjs` CI gate now asserts this stays cron-reachable.
 */
export async function markOverdueInstallmentsInternal(): Promise<{ overdue: number }> {
  const result = await db.rentInstallment.updateMany({
    where: {
      status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      dueDate: { lt: new Date() },
    },
    data: { status: "OVERDUE" },
  });

  return { overdue: result.count };
}
