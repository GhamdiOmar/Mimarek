"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission, getTenantSessionOrThrow } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

// ═══════════════════════════════════════════════════════════════════════════════
// Coupon Validation (Customer-facing)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate a coupon code and return discount info.
 * Used during checkout before applying.
 */
export async function validateCoupon(code: string, planId?: string) {
  await getTenantSessionOrThrow();

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
 */
export async function applyCoupon(couponId: string, invoiceId: string) {
  const session = await getTenantSessionOrThrow();

  const [coupon, invoice] = await Promise.all([
    db.coupon.findUnique({ where: { id: couponId } }),
    db.invoice.findFirst({
      where: { id: invoiceId, organizationId: session.organizationId },
    }),
  ]);

  if (!coupon) throw new Error("Coupon code not found. Please check the code and try again.");
  if (!invoice) throw new Error("Invoice not found or you don't have access. Please verify the invoice number.");

  // Check if already redeemed by this org
  const existing = await db.couponRedemption.findFirst({
    where: { couponId, organizationId: session.organizationId },
  });
  if (existing) throw new Error("This coupon has already been used by your organization.");

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

  await db.$transaction([
    db.invoice.update({
      where: { id: invoiceId },
      data: {
        discountAmount,
        vatAmount,
        total,
        couponId,
      },
    }),
    db.couponRedemption.create({
      data: {
        couponId,
        organizationId: session.organizationId,
        discountApplied: discountAmount,
      },
    }),
    db.coupon.update({
      where: { id: couponId },
      data: { currentUses: { increment: 1 } },
    }),
  ]);

  revalidatePath("/dashboard/billing");
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
      applicableCycles: data.applicableCycles as any,
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

  revalidatePath("/admin/coupons");
  return JSON.parse(JSON.stringify(coupon));
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

  return JSON.parse(JSON.stringify(coupons));
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

  revalidatePath("/admin/coupons");
  return { success: true };
}
