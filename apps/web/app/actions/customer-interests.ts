"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { createReservation } from "./reservations";

// ─── Add a property interest for a customer ───────────────────────────────────
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

  // Upsert: create new or reactivate a DROPPED interest
  const interest = await db.customerPropertyInterest.upsert({
    where: { customerId_unitId: { customerId, unitId } },
    create: { customerId, unitId, intent, status: "ACTIVE" },
    update: { intent, status: "ACTIVE" },
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

  const interest = await db.customerPropertyInterest.findFirst({
    where: { id: interestId },
    include: { customer: { select: { organizationId: true } } },
  });
  if (!interest || interest.customer.organizationId !== session.organizationId) {
    throw new Error("Interest record not found or you don't have access. Please refresh the page.");
  }

  const updated = await db.customerPropertyInterest.update({
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

  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/units");
  return JSON.parse(JSON.stringify(updated));
}

// ─── Convert an interest to a Deal (reservation) ──────────────────────────────
export async function convertInterestToDeal(
  interestId: string,
  data: { amount: number; expiresAt: Date; depositAmount?: number }
) {
  const session = await requirePermission("deals:write");

  const interest = await db.customerPropertyInterest.findFirst({
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

  // Create the reservation (this handles Unit→RESERVED, Customer→RESERVED)
  const reservation = await createReservation({
    customerId: interest.customerId,
    unitId: interest.unitId,
    amount: data.amount,
    expiresAt: data.expiresAt,
    depositAmount: data.depositAmount,
  });

  // Mark interest as CONVERTED
  await db.customerPropertyInterest.update({
    where: { id: interestId },
    data: { status: "CONVERTED" },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "CustomerPropertyInterest",
    resourceId: interestId,
    metadata: { status: "CONVERTED", reservationId: reservation.id },
    organizationId: session.organizationId,
  });

  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/deals");
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

  const interests = await db.customerPropertyInterest.findMany({
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
  const session = await requirePermission("properties:read");

  // Verify unit belongs to org
  const unit = await db.unit.findFirst({
    where: { id: unitId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!unit) throw new Error("Property not found or you don't have access.");

  const interests = await db.customerPropertyInterest.findMany({
    where: { unitId, status: "ACTIVE" },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          phoneHash: true,
          agentId: true,
          agent: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return JSON.parse(JSON.stringify(interests));
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
