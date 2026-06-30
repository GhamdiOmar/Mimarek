"use server";

import { db, type Prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission, requireTenantPermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";

// ═══════════════════════════════════════════════════════════════════════════════
// Coupon Validation (Customer-facing)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate a coupon code and return discount info (pre-apply preview).
 *
 * RESERVED — no active caller. The tenant plans-page coupon preview that called
 * this was removed in v5.27.0 (CX-006): coupons apply to an Invoice via
 * `applyCoupon`, and invoice generation is not yet wired at subscribe-time, so a
 * plans-page discount preview was premature. This validator is intentionally kept
 * as the forward-looking primitive for the invoice/checkout coupon flow at
 * billing go-live (it pairs with the still-wired `applyCoupon`, which re-validates
 * server-side at apply-time — SEC-008). Do not treat as dead code.
 */
export async function validateCoupon(code: string, planId?: string) {
  await requireTenantPermission("billing:read");

  const coupon = await db.coupon.findUnique({
    where: { code: code.toUpperCase().trim() },
    include: { plans: { select: { id: true } } },
  });

  if (!coupon) {
    return { valid: false, reason: "Invalid coupon code" };
  }

  if (!coupon.isActive) {
    return { valid: false, reason: "This coupon is no longer active" };
  }

  const now = new Date();
  if (coupon.validFrom > now) {
    return { valid: false, reason: "This coupon is not yet valid" };
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    return { valid: false, reason: "This coupon has expired" };
  }

  if (coupon.maxRedemptions && coupon.currentUses >= coupon.maxRedemptions) {
    return { valid: false, reason: "This coupon has reached its maximum redemptions" };
  }

  // Check plan restriction
  if (planId && coupon.plans.length > 0) {
    const isPlanAllowed = coupon.plans.some((p) => p.id === planId);
    if (!isPlanAllowed) {
      return { valid: false, reason: "This coupon is not valid for the selected plan" };
    }
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      descriptionEn: coupon.descriptionEn,
      descriptionAr: coupon.descriptionAr,
    },
  };
}

/**
 * Apply a coupon to an invoice and record the redemption.
 *
 * Security: requires billing:write (QA-SEC-02 authz fix).
 * Race fix: the currentUses increment is a conditional updateMany inside an
 * interactive transaction — the WHERE clause enforces the maxRedemptions cap
 * atomically, so two concurrent calls cannot both slip through the limit check.
 */
export async function applyCoupon(couponId: string, invoiceId: string) {
  const session = await requireTenantPermission("billing:write");

  const [coupon, invoice] = await Promise.all([
    db.coupon.findUnique({ where: { id: couponId }, include: { plans: { select: { id: true } } } }),
    db.invoice.findFirst({
      where: { id: invoiceId, organizationId: session.organizationId },
      include: { subscription: { select: { planId: true, billingCycle: true } } },
    }),
  ]);

  if (!coupon) throw new Error("Coupon code not found. Please check the code and try again.");
  if (!invoice) throw new Error("Invoice not found or you don't have access. Please verify the invoice number.");

  // Check if already redeemed by this org (outside tx — fast early-exit, not the race-guard)
  const existing = await db.couponRedemption.findFirst({
    where: { couponId, organizationId: session.organizationId },
  });
  if (existing) throw new Error("This coupon has already been used by your organization.");

  // SEC-008: re-validate the coupon at apply-time (not just at the validateCoupon
  // pre-check). A known coupon id must not be applicable when expired, inactive,
  // restricted to other plans, or restricted to other billing cycles.
  const now = new Date();
  if (!coupon.isActive) throw new Error("This coupon is no longer active.");
  if (coupon.validFrom > now) throw new Error("This coupon is not yet valid.");
  if (coupon.validUntil && coupon.validUntil < now) throw new Error("This coupon has expired.");
  const planId = invoice.subscription?.planId ?? null;
  if (coupon.plans.length > 0 && (!planId || !coupon.plans.some((p) => p.id === planId))) {
    throw new Error("This coupon is not valid for the selected plan.");
  }
  const cycle = (invoice.billingCycle ?? invoice.subscription?.billingCycle) ?? null;
  const cycles = Array.isArray(coupon.applicableCycles) ? (coupon.applicableCycles as string[]) : null;
  if (cycles && cycles.length > 0 && cycle && !cycles.includes(cycle)) {
    throw new Error("This coupon is not valid for this billing cycle.");
  }

  // Calculate discount
  const subtotal = Number(invoice.subtotal);
  let discountAmount: number;

  if (coupon.type === "PERCENTAGE") {
    discountAmount = Math.round((subtotal * Number(coupon.value)) / 100 * 100) / 100;
  } else {
    discountAmount = Math.min(Number(coupon.value), subtotal);
  }

  // Enforce minimum purchase
  if (coupon.minPurchaseAmount && subtotal < Number(coupon.minPurchaseAmount)) {
    throw new Error("This coupon requires a minimum purchase amount. Please check the coupon terms.");
  }

  // Recalculate invoice
  const newSubtotal = subtotal - discountAmount;
  const vatAmount = newSubtotal * Number(invoice.vatRate);
  const total = newSubtotal + vatAmount;

  // Interactive transaction: conditional increment FIRST to close the race window.
  // updateMany's WHERE clause acts as an atomic compare-and-increment:
  //   - if maxRedemptions is null  → no cap, always matches
  //   - if currentUses < maxRedemptions → still under cap, matches
  //   - otherwise (cap hit)        → count === 0, we throw before writing the invoice
  await db.$transaction(async (tx) => {
    const capResult = await tx.coupon.updateMany({
      where: {
        id: couponId,
        OR: [
          { maxRedemptions: null },
          { currentUses: { lt: coupon.maxRedemptions! } },
        ],
      },
      data: { currentUses: { increment: 1 } },
    });

    if (capResult.count !== 1) {
      throw new Error("This coupon has reached its maximum redemptions.");
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        discountAmount,
        vatAmount,
        total,
        couponId,
      },
    });

    await tx.couponRedemption.create({
      data: {
        couponId,
        organizationId: session.organizationId,
        discountApplied: discountAmount,
      },
    });
  });

  revalidatePath(ROUTES.billing);
  return { discountAmount, newTotal: total };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin: Coupon Management (System-level)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Admin: Create a coupon.
 */
export async function adminCreateCoupon(data: {
  code: string;
  descriptionEn?: string;
  descriptionAr?: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  maxRedemptions?: number;
  validFrom?: Date;
  validUntil?: Date;
  minPurchaseAmount?: number;
  planIds?: string[];
  applicableCycles?: string[];
}) {
  const session = await requirePermission("billing:admin");

  const coupon = await db.coupon.create({
    data: {
      code: data.code.toUpperCase().trim(),
      descriptionEn: data.descriptionEn,
      descriptionAr: data.descriptionAr,
      type: data.type,
      value: data.value,
      maxRedemptions: data.maxRedemptions,
      validFrom: data.validFrom ?? new Date(),
      validUntil: data.validUntil,
      minPurchaseAmount: data.minPurchaseAmount,
      applicableCycles: data.applicableCycles as Prisma.InputJsonValue,
      plans: data.planIds
        ? { connect: data.planIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "CREATE", resource: "Coupon", resourceId: coupon.id,
    metadata: { code: coupon.code, type: data.type, value: data.value },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.adminCoupons);
  return serialize(coupon);
}

/**
 * Admin: Get all coupons.
 */
export async function adminGetCoupons() {
  await requirePermission("billing:admin");

  const coupons = await db.coupon.findMany({
    include: {
      plans: { select: { id: true, slug: true, nameEn: true } },
      _count: { select: { redemptions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return serialize(coupons);
}

/**
 * Admin: Toggle coupon active/inactive.
 */
export async function adminToggleCoupon(couponId: string, isActive: boolean) {
  const session = await requirePermission("billing:admin");

  await db.coupon.update({
    where: { id: couponId },
    data: { isActive },
  });

  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "UPDATE", resource: "Coupon", resourceId: couponId,
    metadata: { isActive },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.adminCoupons);
  return { success: true };
}
