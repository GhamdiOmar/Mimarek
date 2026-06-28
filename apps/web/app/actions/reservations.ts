"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { requireEntitlement, FEATURE_KEYS } from "../../lib/entitlements";
import { syncDealStageForUnit } from "../../lib/server/pipeline-sync";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";

export async function createReservation(data: {
  customerId: string;
  unitId: string;
  amount: number;
  expiresAt: Date;
  depositRequired?: boolean;
  depositAmount?: number;
}) {
  const session = await requirePermission("reservations:write");

  // Verify customer belongs to org
  const customer = await db.customer.findFirst({
    where: { id: data.customerId, organizationId: session.organizationId },
  });
  if (!customer) throw new Error("Customer not found or you don't have access. Please verify the customer exists in your organization.");

  // RED: Duplicate check — prevent same customer + unit reservation
  const existingReservation = await db.reservation.findFirst({
    where: {
      customerId: data.customerId,
      unitId: data.unitId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });
  if (existingReservation) {
    throw new Error("This customer already has an active reservation for this unit. Please cancel the existing reservation first or choose a different unit.");
  }

  // Entitlement gate: Reservations module access.
  await requireEntitlement(session.organizationId, FEATURE_KEYS.RESERVATIONS_ACCESS);

  // RED: Race condition guard — CAS (compare-and-swap) on unit status inside transaction.
  // A plain findFirst+update races; updateMany with a WHERE status="AVAILABLE" is atomic.
  const reservation = await db.$transaction(async (tx) => {
    // Verify the unit exists and belongs to the org (needed for the not-found error).
    const unit = await tx.unit.findFirst({
      where: { id: data.unitId, organizationId: session.organizationId },
    });
    if (!unit) {
      throw new Error("Unit not found or you don't have access. Please verify the unit exists in your organization.");
    }

    // CAS: claim the unit only if it is still AVAILABLE.
    // count === 0 means another request won the race (or the unit was already non-AVAILABLE).
    const claim = await tx.unit.updateMany({
      where: { id: data.unitId, organizationId: session.organizationId, status: "AVAILABLE" },
      data: { status: "RESERVED" },
    });
    if (claim.count === 0) {
      throw new Error("This unit is no longer available for reservation. It may have been reserved or sold. Please select another unit.");
    }

    // Create reservation
    const res = await tx.reservation.create({
      data: {
        organizationId: session.organizationId,
        customerId: data.customerId,
        unitId: data.unitId,
        amount: data.amount,
        expiresAt: data.expiresAt,
        userId: session.userId,
        status: "PENDING",
        depositRequired: data.depositRequired ?? false,
        depositAmount: data.depositAmount,
      },
    });

    return res;
  });

  // Pipeline state is owned by the Deal entity now (R3). Advance the relevant
  // deal to RESERVED and let Customer.status be recomputed from it instead of
  // writing Customer.status directly.
  await syncDealStageForUnit(data.customerId, data.unitId, "RESERVED");

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "Reservation",
    resourceId: reservation.id,
    metadata: { depositRequired: data.depositRequired },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.reservations);
  return serialize(reservation);
}

export async function getReservations(filters?: { page?: number; pageSize?: number }) {
  const session = await requirePermission("reservations:read");

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const reservations = await db.reservation.findMany({
    where: {
      customer: { organizationId: session.organizationId },
    },
    include: {
      unit: true,
      customer: true,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
  });
  return serialize(reservations);
}

export async function updateReservationStatus(
  reservationId: string,
  status: "CONFIRMED" | "CANCELLED" | "EXPIRED"
) {
  const session = await requirePermission("reservations:write");

  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, customer: { organizationId: session.organizationId } },
    include: { customer: true },
  });
  if (!reservation) {
    throw new Error("Reservation not found or you don't have access. Please refresh the page and try again.");
  }

  let revertToQualified = false;

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.reservation.update({
      where: { id: reservationId },
      data: { status },
    });

    // If cancelled/expired, free the unit and revert customer status
    if (status === "CANCELLED" || status === "EXPIRED") {
      await tx.unit.update({
        where: { id: reservation.unitId },
        data: { status: "AVAILABLE" },
      });
      // Revert pipeline to QUALIFIED only if no other active reservations
      const otherActive = await tx.reservation.count({
        where: {
          customerId: reservation.customerId,
          id: { not: reservationId },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });
      if (otherActive === 0) {
        revertToQualified = true;
      }
    }

    // If confirmed, mark unit as SOLD
    if (status === "CONFIRMED") {
      await tx.unit.update({
        where: { id: reservation.unitId },
        data: { status: "SOLD" },
      });
    }

    return res;
  });

  // Pipeline status is derived from the Deal entity now (R3) — set the relevant
  // deal stage and recompute Customer.status instead of writing it directly.
  if (status === "CONFIRMED") {
    await syncDealStageForUnit(reservation.customerId, reservation.unitId, "WON");
  } else if (revertToQualified) {
    await syncDealStageForUnit(reservation.customerId, reservation.unitId, "QUALIFIED");
  }

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Reservation",
    resourceId: reservationId,
    before: { status: reservation.status },
    after: { status },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.reservations);
  return serialize(updated);
}

// ─── RED: Reservation Extensions ────────────────────────────────────────────

export async function requestReservationExtension(
  reservationId: string,
  newExpiresAt: string,
  reason?: string
) {
  const session = await requirePermission("reservations:write");

  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, customer: { organizationId: session.organizationId } },
    include: { customer: true },
  });
  if (!reservation) {
    throw new Error("Reservation not found or you don't have access. Please refresh the page and try again.");
  }

  const extension = await db.reservationExtension.create({
    data: {
      reservationId,
      requestedBy: session.userId,
      newExpiresAt: new Date(newExpiresAt),
      reason,
    },
  });

  return serialize(extension);
}

export async function approveReservationExtension(extensionId: string) {
  const session = await requirePermission("reservations:write");

  const extension = await db.reservationExtension.findFirst({
    where: { id: extensionId },
    include: { reservation: { include: { customer: true } } },
  });
  if (!extension || extension.reservation.customer.organizationId !== session.organizationId) {
    throw new Error("Reservation extension not found or you don't have access. Please refresh and try again.");
  }

  if (extension.status !== "PENDING_EXTENSION") {
    throw new Error("This extension has already been processed and is no longer pending approval.");
  }

  await db.$transaction([
    db.reservationExtension.update({
      where: { id: extensionId },
      data: { status: "APPROVED_EXTENSION", approvedBy: session.userId },
    }),
    db.reservation.update({
      where: { id: extension.reservationId },
      data: {
        expiresAt: extension.newExpiresAt,
      },
    }),
  ]);

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "ReservationExtension",
    resourceId: extensionId,
    metadata: { reservationId: extension.reservationId, newExpiresAt: extension.newExpiresAt },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.reservations);
  return { success: true };
}

export async function getReservationById(reservationId: string) {
  const session = await requirePermission("reservations:read");
  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, customer: { organizationId: session.organizationId } },
    include: {
      customer: { select: { id: true, name: true } },
      unit: { select: { id: true, number: true } },
    },
  });
  if (!reservation) return null;
  return serialize(reservation);
}

// ─── CX-010: Bulk Operations ────────────────────────────────────────────────

export async function bulkUpdateReservationStatus(
  ids: string[],
  status: "CANCELLED"
) {
  if (!ids.length) return { updated: 0 };
  const session = await requirePermission("deals:write");

  // Verify all reservations belong to the org
  const reservations = await db.reservation.findMany({
    where: { id: { in: ids }, customer: { organizationId: session.organizationId } },
    include: { customer: true },
  });

  if (reservations.length !== ids.length) {
    throw new Error(
      "One or more reservations do not belong to your organization. Please refresh and try again."
    );
  }

  // Only update reservations that are cancellable (PENDING or CONFIRMED)
  const cancellable = reservations.filter(
    (r) => r.status === "PENDING" || r.status === "CONFIRMED"
  );

  if (!cancellable.length) return { updated: 0 };

  const updated = await db.$transaction(async (tx) => {
    // Cancel each reservation and free its unit
    const results = await Promise.all(
      cancellable.map(async (res) => {
        const updated = await tx.reservation.update({
          where: { id: res.id },
          data: { status },
        });
        await tx.unit.update({
          where: { id: res.unitId },
          data: { status: "AVAILABLE" },
        });
        return updated;
      })
    );
    return results;
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Reservation",
    resourceId: "bulk",
    metadata: { bulkStatus: status, count: updated.length, ids: cancellable.map((r) => r.id) },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.reservations);
  return { updated: updated.length };
}

export async function bulkDeleteReservations(ids: string[]) {
  if (!ids.length) return { deleted: 0 };
  const session = await requirePermission("deals:delete");

  // Verify all reservations belong to the org
  const reservations = await db.reservation.findMany({
    where: { id: { in: ids }, customer: { organizationId: session.organizationId } },
    include: { customer: true },
  });

  if (reservations.length !== ids.length) {
    throw new Error(
      "One or more reservations do not belong to your organization. Please refresh and try again."
    );
  }

  await db.$transaction(async (tx) => {
    // Free units for non-terminal reservations before deleting
    const activeStatuses = ["PENDING", "CONFIRMED"] as const;
    const active = reservations.filter((r) =>
      (activeStatuses as readonly string[]).includes(r.status)
    );
    await Promise.all(
      active.map((res) =>
        tx.unit.update({
          where: { id: res.unitId },
          data: { status: "AVAILABLE" },
        })
      )
    );

    // Delete reservation extensions first (FK constraint)
    await tx.reservationExtension.deleteMany({
      where: { reservationId: { in: ids } },
    });

    await tx.reservation.deleteMany({
      where: { id: { in: ids }, customer: { organizationId: session.organizationId } },
    });
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "DELETE",
    resource: "Reservation",
    resourceId: "bulk",
    metadata: { count: reservations.length, ids },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.reservations);
  return { deleted: reservations.length };
}

// ─── Auto-Expire Batch ──────────────────────────────────────────────────────
// Moved to `lib/server/reservation-expiry.ts` (QA-SEC-01): a cron-only batch
// helper must not be an exported `"use server"` RPC. The cron route imports it
// from there directly.
