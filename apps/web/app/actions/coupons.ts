"use server";

import { db, type Prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission, requireTenantPermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { CouponError } from "../../lib/coupon-errors";

/** Invoice statuses a coupon may still be applied to (not settled / dead). */
const COUPON_APPLICABLE_STATUSES = ["DRAFT", "ISSUED", "OVERDUE"] as const;

/** Round a money value to 2 decimals (halalah) — same convention as the discount. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

  if (!coupon) throw new CouponError("INVALID", "Coupon code not found. Please check the code and try again.");
  if (!invoice) throw new CouponError("NO_INVOICE", "Invoice not found or you don't have access. Please verify the invoice number.");

  // One coupon per invoice — enforced SERVER-SIDE, not just in the UI. Without this a
  // direct RPC could stack a second/different coupon, recompute the discount off the
  // pristine subtotal, and orphan the first redemption row (adversarial H-1).
  if (invoice.couponId) {
    throw new CouponError("ALREADY_COUPONED", "A coupon has already been applied to this invoice.");
  }

  // A coupon may only discount an invoice that is still open — never a settled
  // (PAID/PARTIALLY_PAID), canceled, or refunded one (would drop the recorded total
  // below what was collected). The UI hides the affordance; the server enforces it.
  if (!(COUPON_APPLICABLE_STATUSES as readonly string[]).includes(invoice.status)) {
    throw new CouponError("INVOICE_NOT_OPEN", "This invoice can no longer be discounted.");
  }

  // Check if already redeemed by this org (outside tx — fast early-exit, not the race-guard)
  const existing = await db.couponRedemption.findFirst({
    where: { couponId, organizationId: session.organizationId },
  });
  if (existing) throw new CouponError("ALREADY_USED", "This coupon has already been used by your organization.");

  // SEC-008: re-validate the coupon at apply-time (not just at the validateCoupon
  // pre-check). A known coupon id must not be applicable when expired, inactive,
  // restricted to other plans, or restricted to other billing cycles.
  const now = new Date();
  if (!coupon.isActive) throw new CouponError("INACTIVE", "This coupon is no longer active.");
  if (coupon.validFrom > now) throw new CouponError("NOT_YET_VALID", "This coupon is not yet valid.");
  if (coupon.validUntil && coupon.validUntil < now) throw new CouponError("EXPIRED", "This coupon has expired.");
  const planId = invoice.subscription?.planId ?? null;
  if (coupon.plans.length > 0 && (!planId || !coupon.plans.some((p) => p.id === planId))) {
    throw new CouponError("WRONG_PLAN", "This coupon is not valid for the selected plan.");
  }
  const cycle = (invoice.billingCycle ?? invoice.subscription?.billingCycle) ?? null;
  const cycles = Array.isArray(coupon.applicableCycles) ? (coupon.applicableCycles as string[]) : null;
  if (cycles && cycles.length > 0 && cycle && !cycles.includes(cycle)) {
    throw new CouponError("WRONG_CYCLE", "This coupon is not valid for this billing cycle.");
  }

  // Calculate discount
  const subtotal = Number(invoice.subtotal);
  let discountAmount: number;

  if (coupon.type === "PERCENTAGE") {
    discountAmount = round2((subtotal * Number(coupon.value)) / 100);
  } else {
    discountAmount = Math.min(Number(coupon.value), subtotal);
  }

  // Enforce minimum purchase
  if (coupon.minPurchaseAmount && subtotal < Number(coupon.minPurchaseAmount)) {
    throw new CouponError("MIN_PURCHASE", "This coupon requires a minimum purchase amount. Please check the coupon terms.");
  }

  // Recalculate invoice — round the VAT + total to halalah (M-2); a ZATCA-reported
  // VAT figure must reconcile exactly, not drift on the DB column's implicit rounding.
  const newSubtotal = round2(subtotal - discountAmount);
  const vatAmount = round2(newSubtotal * Number(invoice.vatRate));
  const total = round2(newSubtotal + vatAmount);

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
      throw new CouponError("MAX_REDEEMED", "This coupon has reached its maximum redemptions.");
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

/**
 * UI entry point: apply a coupon to an invoice by its CODE (the tenant enters a
 * promo code, not an internal id). Resolves the code → coupon, then delegates to
 * `applyCoupon` (which re-validates + records the redemption atomically).
 *
 * Returns a discriminated RESULT with a STABLE reason CODE instead of throwing —
 * `applyCoupon`'s thrown messages would be redacted across the server-action
 * boundary in production (CX-001/CX-002), so we catch them server-side and map
 * to a code the client renders bilingually.
 */
export async function applyCouponByCode(
  code: string,
  invoiceId: string,
): Promise<
  | { ok: true; discountAmount: number; newTotal: number }
  | { ok: false; reason: string }
> {
  await requireTenantPermission("billing:write");

  const trimmed = code.trim();
  if (!trimmed) return { ok: false, reason: "INVALID" };

  const coupon = await db.coupon.findUnique({
    where: { code: trimmed.toUpperCase() },
    select: { id: true },
  });
  if (!coupon) return { ok: false, reason: "INVALID" };

  try {
    const res = await applyCoupon(coupon.id, invoiceId);
    return { ok: true, discountAmount: res.discountAmount, newTotal: res.newTotal };
  } catch (err) {
    // `applyCoupon` throws a typed CouponError carrying a stable reason code — read
    // it directly (no brittle message regex, /mimaric-qa M1). Caught server-side, so
    // the message never crosses to the client to be redacted.
    if (err instanceof CouponError) return { ok: false, reason: err.reason };
    console.error("[coupons] applyCouponByCode unexpected error:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "FAILED" };
  }
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
