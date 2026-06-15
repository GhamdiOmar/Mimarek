import "server-only";

import { db } from "@repo/db";
import { syncDealStageForUnit } from "./pipeline-sync";

/**
 * Auto-expire PENDING reservations past their `expiresAt`.
 *
 * Server-only batch helper (QA-SEC-01): invoked ONLY by the cron route
 * `/api/cron/expire-reservations` (CRON_SECRET-gated). It is NOT a `"use server"`
 * action — keeping it out of `app/actions/**` means it is not a network-reachable
 * RPC. Takes no caller-supplied input; mutates only globally-expired rows.
 */
export async function autoExpireReservations() {
  const now = new Date();

  const expired = await db.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, unitId: true, customerId: true },
  });

  for (const res of expired) {
    let revertToQualified = false;
    await db.$transaction(async (tx) => {
      await tx.reservation.update({ where: { id: res.id }, data: { status: "EXPIRED" } });
      await tx.unit.update({ where: { id: res.unitId }, data: { status: "AVAILABLE" } });
      // Revert pipeline if no other active reservations
      const otherActive = await tx.reservation.count({
        where: { customerId: res.customerId, id: { not: res.id }, status: { in: ["PENDING", "CONFIRMED"] } },
      });
      if (otherActive === 0) {
        revertToQualified = true;
      }
    });
    // Pipeline status is derived from the Deal entity now (R3).
    if (revertToQualified) {
      await syncDealStageForUnit(res.customerId, res.unitId, "QUALIFIED");
    }
  }

  return { expired: expired.length };
}
