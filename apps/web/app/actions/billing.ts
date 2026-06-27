"use server";

import { db, type Prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { createSubscription, transitionSubscription } from "../../lib/payment/subscription-machine";
import { invalidateEntitlements } from "../../lib/entitlements";
import { getNextSequenceValue, GLOBAL_SEQUENCE_SCOPE } from "../../lib/sequence";
import { getPublicPlans } from "../../lib/server/plans";
import { clearSubscriptionInvoiceInternal } from "../../lib/zatca-clearance";

// ═══════════════════════════════════════════════════════════════════════════════
// Plans (Public)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Public plans list. The cached query lives in the server-only DAL
 * (lib/server/plans.ts) — this is a thin async server-action wrapper so CLIENT
 * components can call it over RPC without pulling @repo/db/pg into their bundle.
 * As an `async function` export it satisfies the §4 "use server" rule (the
 * landmine was the old `export const getPlans = unstable_cache(...)` — a
 * non-async-function export — which is now gone).
 */
// eslint-disable-next-line mimaric/require-action-guard -- public plan catalogue (pricing page); no tenant data or PII, read-only.
export async function getPlans() {
  return getPublicPlans();
}

/**
 * Get a single plan by slug.
 */
// eslint-disable-next-line mimaric/require-action-guard -- public plan lookup by slug (pricing page); no tenant data or PII, read-only.
export async function getPlanBySlug(slug: string) {
  const plan = await db.plan.findFirst({
    where: { slug, isPublic: true },
    include: { entitlements: true },
  });
  return plan ? serialize(plan) : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Subscriptions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the current subscription for the logged-in user's organization.
 */
export async function getCurrentSubscription() {
  const session = await requirePermission("billing:read");

  const subscription = await db.subscription.findFirst({
    where: {
      organizationId: session.organizationId,
      status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED"] },
    },
    include: {
      plan: { include: { entitlements: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return subscription ? serialize(subscription) : null;
}

/**
 * Subscribe to a plan (start trial or direct).
 */
export async function subscribeToPlan(data: {
  planId: string;
  billingCycle: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
  startTrial?: boolean;
}) {
  const session = await requirePermission("billing:write");

  // Check if org already has an active subscription
  const existing = await db.subscription.findFirst({
    where: {
      organizationId: session.organizationId,
      status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
    },
  });

  if (existing) {
    throw new Error("Your organization already has an active subscription. To change plans, please use the upgrade or downgrade option instead.");
  }

  const plan = await db.plan.findFirst({
    where: { id: data.planId, isPublic: true },
    select: { id: true },
  });
  if (!plan) {
    throw new Error("The selected plan is not available. Please choose a plan from the pricing page.");
  }

  const subscriptionId = await createSubscription({
    organizationId: session.organizationId,
    planId: data.planId,
    billingCycle: data.billingCycle,
    startTrial: data.startTrial ?? true,
  });

  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "CREATE", resource: "Subscription", resourceId: subscriptionId,
    metadata: { planId: data.planId, billingCycle: data.billingCycle },
    organizationId: session.organizationId,
  });

  invalidateEntitlements(session.organizationId);
  revalidatePath(ROUTES.billing);

  return { subscriptionId };
}

/**
 * Change plan (upgrade or downgrade).
 */
export async function changePlan(data: {
  newPlanId: string;
  billingCycle?: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
}) {
  const session = await requirePermission("billing:write");

  const current = await db.subscription.findFirst({
    where: {
      organizationId: session.organizationId,
      status: { in: ["TRIALING", "ACTIVE"] },
    },
  });

  if (!current) {
    throw new Error("There is no active subscription to change. Please subscribe to a plan first.");
  }

  const newPlan = await db.plan.findFirst({ where: { id: data.newPlanId, isPublic: true } });
  if (!newPlan) throw new Error("The selected plan was not found. Please refresh and try again.");

  const billingCycle = data.billingCycle ?? current.billingCycle;

  // Update subscription to new plan
  await db.subscription.update({
    where: { id: current.id },
    data: {
      planId: data.newPlanId,
      billingCycle,
      priceAtRenewal: billingCycle === "ANNUAL" ? newPlan.priceAnnual : newPlan.priceMonthly,
    },
  });

  // Log event
  await db.subscriptionEvent.create({
    data: {
      subscriptionId: current.id,
      fromStatus: current.status,
      toStatus: current.status,
      triggeredBy: `user:${session.userId}`,
      reason: `Plan changed to ${newPlan.slug}`,
      metadata: {
        previousPlanId: current.planId,
        newPlanId: data.newPlanId,
        billingCycle,
      },
    },
  });

  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "UPDATE", resource: "Subscription", resourceId: current.id,
    metadata: { previousPlanId: current.planId, newPlanId: data.newPlanId },
    organizationId: session.organizationId,
  });

  invalidateEntitlements(session.organizationId);
  revalidatePath(ROUTES.billing);

  return { success: true };
}

/**
 * Cancel the current subscription.
 */
export async function cancelSubscription(reason?: string) {
  const session = await requirePermission("billing:write");

  const current = await db.subscription.findFirst({
    where: {
      organizationId: session.organizationId,
      status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
    },
  });

  if (!current) {
    throw new Error("There is no active subscription to cancel.");
  }

  await transitionSubscription(
    current.id,
    "CANCELED",
    `user:${session.userId}`,
    reason || "User-initiated cancellation"
  );

  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "UPDATE", resource: "Subscription", resourceId: current.id,
    metadata: { action: "canceled", reason },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.billing);

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Invoices
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get invoices for the current organization.
 */
export async function getInvoices(page = 1, pageSize = 20) {
  const session = await requirePermission("billing:read");

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where: { organizationId: session.organizationId },
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.invoice.count({
      where: { organizationId: session.organizationId },
    }),
  ]);

  return {
    invoices: serialize(invoices),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get a single invoice by ID.
 */
export async function getInvoiceById(invoiceId: string) {
  const session = await requirePermission("billing:read");

  const invoice = await db.invoice.findFirst({
    where: {
      id: invoiceId,
      organizationId: session.organizationId,
    },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      transactions: { orderBy: { initiatedAt: "desc" } },
      coupon: true,
    },
  });

  if (!invoice) throw new Error("Invoice not found or you don't have access. Please verify the invoice number.");

  return serialize(invoice);
}

/**
 * Generate a sequential invoice number atomically inside an existing transaction.
 *
 * `invoiceNumber` is GLOBALLY unique (`INV-YYYY-NNNNN`, no org partition) and the
 * issuing entity is the single Mimarek platform — so the counter is GLOBAL, not
 * per-org. A per-org counter would let two tenants both mint `INV-2026-00001` and
 * collide on the global unique index. This preserves the original global-max semantics.
 *
 * Preserved format: `INV-${year}-${5-digit-padded-seq}`  e.g. INV-2026-00001
 */
async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const year = new Date().getFullYear();
  const seqValue = await getNextSequenceValue(tx, GLOBAL_SEQUENCE_SCOPE, "INVOICE", year);
  return `INV-${year}-${String(seqValue).padStart(5, "0")}`;
}

/**
 * Generate an invoice for a subscription billing period.
 */
export async function generateSubscriptionInvoice(params: {
  subscriptionId: string;
  description?: string;
}) {
  const session = await requirePermission("billing:write");

  const subscription = await db.subscription.findUnique({
    where: { id: params.subscriptionId },
    include: { plan: true, organization: true },
  });

  if (!subscription) throw new Error("Subscription not found. Please refresh and try again.");
  if (subscription.organizationId !== session.organizationId) {
    throw new Error("You don't have permission to perform this action. Please contact your administrator.");
  }

  const price = subscription.billingCycle === "ANNUAL"
    ? subscription.plan.priceAnnual
    : subscription.plan.priceMonthly;

  const priceNum = Number(price);
  const vatRate = 0.15; // Saudi VAT 15%
  const vatAmount = priceNum * vatRate;
  const total = priceNum + vatAmount;

  // Generate invoice number and create the invoice atomically so the sequence
  // bump and the invoice row are committed together (or both roll back).
  const invoice = await db.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber(tx);

    return tx.invoice.create({
      data: {
        invoiceNumber,
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        status: "ISSUED",
        billingCycle: subscription.billingCycle,
        subtotal: priceNum,
        vatRate,
        vatAmount,
        total,
        currency: "SAR",
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
        lineItems: {
          create: [
            {
              description: `${subscription.plan.nameEn} - ${subscription.billingCycle} subscription`,
              descriptionAr: `${subscription.plan.nameAr} - اشتراك ${getBillingCycleAr(subscription.billingCycle)}`,
              quantity: 1,
              unitPrice: priceNum,
              vatRate,
              vatAmount,
              total,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { lineItems: true },
    });
  });

  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "CREATE", resource: "Invoice", resourceId: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, total, subscriptionId: subscription.id },
    organizationId: session.organizationId,
  });

  // ZATCA Track A: clear the SaaS invoice through the platform EGS (best-effort — NEVER
  // blocks invoice creation). Outcome is recorded on the invoice (PENDING/REJECTED/CLEARED)
  // + the clearance log; a no-EGS / failure leaves the invoice as-is.
  try {
    await clearSubscriptionInvoiceInternal(invoice.id);
  } catch (err) {
    console.error("[zatca] subscription clearance failed (non-blocking):", err instanceof Error ? err.message : err);
  }
  const refreshed = await db.invoice.findUnique({ where: { id: invoice.id }, include: { lineItems: true } });
  return serialize(refreshed ?? invoice);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Payment Methods
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get saved payment methods for the current organization.
 */
export async function getPaymentMethods() {
  const session = await requirePermission("billing:read");

  const methods = await db.paymentMethod.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return serialize(methods);
}

/**
 * Set a payment method as the default.
 */
export async function setDefaultPaymentMethod(paymentMethodId: string) {
  const session = await requirePermission("billing:write");

  // Verify ownership
  const method = await db.paymentMethod.findFirst({
    where: { id: paymentMethodId, organizationId: session.organizationId },
  });
  if (!method) throw new Error("Payment method not found. Please verify it still exists or add a new one.");

  // Unset all, then set the chosen one
  await db.$transaction([
    db.paymentMethod.updateMany({
      where: { organizationId: session.organizationId },
      data: { isDefault: false },
    }),
    db.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath(ROUTES.billing);
  return { success: true };
}

/**
 * Delete a payment method.
 */
export async function deletePaymentMethod(paymentMethodId: string) {
  const session = await requirePermission("billing:write");

  const method = await db.paymentMethod.findFirst({
    where: { id: paymentMethodId, organizationId: session.organizationId },
  });
  if (!method) throw new Error("Payment method not found. Please verify it still exists or add a new one.");

  await db.paymentMethod.delete({ where: { id: paymentMethodId } });

  revalidatePath(ROUTES.billing);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Actions (System-level)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Admin: Get all plans (public and draft) with entitlements.
 */
export async function adminGetAllPlans() {
  await requirePermission("billing:admin");

  const plans = await db.plan.findMany({
    include: { entitlements: true },
    orderBy: { sortOrder: "asc" },
  });
  return serialize(plans);
}

/**
 * Admin: Get all subscriptions across all organizations.
 */
export async function adminGetAllSubscriptions(page = 1, pageSize = 50) {
  await requirePermission("billing:admin");

  const [subscriptions, total] = await Promise.all([
    db.subscription.findMany({
      include: {
        plan: true,
        organization: { select: { id: true, name: true, nameArabic: true, crNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.subscription.count(),
  ]);

  return {
    subscriptions: serialize(subscriptions),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Admin: Create or update a plan.
 */
export async function adminUpsertPlan(data: {
  id?: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  priceMonthly: number;
  priceAnnual: number;
  trialDays?: number;
  isPublic?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  features?: unknown;
  entitlements?: { featureKey: string; type: "BOOLEAN" | "LIMIT" | "METERED"; value: string }[];
}) {
  const session = await requirePermission("billing:admin");

  const planData = {
    slug: data.slug,
    nameEn: data.nameEn,
    nameAr: data.nameAr,
    descriptionEn: data.descriptionEn,
    descriptionAr: data.descriptionAr,
    priceMonthly: data.priceMonthly,
    priceAnnual: data.priceAnnual,
    trialDays: data.trialDays ?? 14,
    isPublic: data.isPublic ?? true,
    isDefault: data.isDefault ?? false,
    sortOrder: data.sortOrder ?? 0,
    features: data.features as Prisma.InputJsonValue,
  };

  let plan;
  if (data.id) {
    plan = await db.plan.update({ where: { id: data.id }, data: planData });
  } else {
    plan = await db.plan.create({ data: planData });
  }

  // Sync entitlements
  if (data.entitlements) {
    // Delete existing and recreate
    await db.planEntitlement.deleteMany({ where: { planId: plan.id } });
    await db.planEntitlement.createMany({
      data: data.entitlements.map((e) => ({
        planId: plan.id,
        featureKey: e.featureKey,
        type: e.type,
        value: e.value,
      })),
    });
  }

  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: data.id ? "UPDATE" : "CREATE", resource: "Plan", resourceId: plan.id,
    metadata: { slug: data.slug },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.adminPlans);
  return serialize(plan);
}

/**
 * Admin: Create an entitlement override for a specific organization.
 */
export async function adminCreateOverride(data: {
  organizationId: string;
  featureKey: string;
  type: "BOOLEAN" | "LIMIT" | "METERED";
  value: string;
  reason?: string;
  expiresAt?: Date;
}) {
  const session = await requirePermission("billing:admin");

  const override = await db.entitlementOverride.upsert({
    where: {
      organizationId_featureKey: {
        organizationId: data.organizationId,
        featureKey: data.featureKey,
      },
    },
    create: {
      organizationId: data.organizationId,
      featureKey: data.featureKey,
      type: data.type,
      value: data.value,
      reason: data.reason,
      grantedBy: session.userId,
      expiresAt: data.expiresAt,
    },
    update: {
      type: data.type,
      value: data.value,
      reason: data.reason,
      grantedBy: session.userId,
      expiresAt: data.expiresAt,
    },
  });

  invalidateEntitlements(data.organizationId);

  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "CREATE", resource: "EntitlementOverride", resourceId: override.id,
    metadata: { targetOrgId: data.organizationId, featureKey: data.featureKey, value: data.value },
    organizationId: session.organizationId,
  });

  return serialize(override);
}

/**
 * Admin: Get all invoices across all organizations.
 */
export async function adminGetAllInvoices(page = 1, pageSize = 50) {
  await requirePermission("billing:admin");

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      include: {
        lineItems: true,
        organization: { select: { id: true, name: true, nameArabic: true } },
        subscription: { select: { id: true, plan: { select: { nameEn: true, nameAr: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.invoice.count(),
  ]);

  return {
    invoices: serialize(invoices),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function getBillingCycleAr(cycle: string): string {
  const map: Record<string, string> = {
    MONTHLY: "شهري",
    QUARTERLY: "ربع سنوي",
    SEMI_ANNUAL: "نصف سنوي",
    ANNUAL: "سنوي",
  };
  return map[cycle] ?? cycle;
}
