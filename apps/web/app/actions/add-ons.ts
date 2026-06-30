"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { invalidateEntitlements } from "../../lib/entitlements";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";

// ═══════════════════════════════════════════════════════════════════════════
// Add-ons — pricing P4.
//
// Admin CRUD (billing:admin, SYSTEM-only) curates sellable add-ons that grant an
// entitlement (BOOLEAN flip or LIMIT, ADDITIVE/OVERRIDE). Tenant self-service
// (billing:read/write) lists + purchases + cancels them. Granted entitlements
// flow through the evaluator's add-on tier (override > add-on > plan > deny), so
// every P1 gate honours them with zero call-site changes.
// ═══════════════════════════════════════════════════════════════════════════

type Pricing = "FLAT" | "PER_SEAT" | "PER_UNIT" | "PER_INVOICE" | "USAGE" | "CUSTOM";

type AddOnInput = {
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  pricingModel: Pricing;
  priceMonthly: number;
  priceAnnual: number;
  grantsFeatureKey?: string | null;
  grantsType?: "BOOLEAN" | "LIMIT" | "METERED" | null;
  grantsValue?: string | null;
  limitMode?: "ADDITIVE" | "OVERRIDE";
  isPublic?: boolean;
  isActive?: boolean;
  billingDeferred?: boolean;
  sortOrder?: number;
  planIds?: string[];
};

// Module-private (not exported — keeps the "use server" file async-only, §4).
// Guards against a misconfigured add-on that would silently grant nothing while
// still charging the buyer (the admin is SYSTEM-trusted; this is hardening).
function validateGrant(
  featureKey: string | null | undefined,
  type: string | null | undefined,
  value: string | null | undefined,
) {
  if (!featureKey?.trim()) return; // no entitlement grant — a pure billing line item is allowed
  if (!type || value == null || value.trim() === "") {
    throw new Error("An add-on with a feature key needs a grant type and value.");
  }
  if (type === "BOOLEAN" && value !== "true" && value !== "false") {
    throw new Error("Boolean grant value must be 'true' or 'false'.");
  }
  if (type === "LIMIT" && value !== "unlimited" && !/^\d+$/.test(value.trim())) {
    throw new Error("Limit grant value must be a whole number or 'unlimited'.");
  }
}

// ── Admin (platform) CRUD ───────────────────────────────────────────────────

/** Create a sellable add-on (cross-tenant catalogue). USAGE/CUSTOM default to billing-deferred. */
export async function adminCreateAddOn(data: AddOnInput) {
  const session = await requirePermission("billing:admin");
  if (!data.slug?.trim() || !data.nameEn?.trim() || !data.nameAr?.trim()) {
    throw new Error("Add a slug and a bilingual name.");
  }
  validateGrant(data.grantsFeatureKey, data.grantsType, data.grantsValue);
  const addOn = await db.addOn.create({
    data: {
      slug: data.slug.trim().toLowerCase(),
      nameEn: data.nameEn.trim(),
      nameAr: data.nameAr.trim(),
      descriptionEn: data.descriptionEn?.trim() || null,
      descriptionAr: data.descriptionAr?.trim() || null,
      pricingModel: data.pricingModel,
      priceMonthly: data.priceMonthly,
      priceAnnual: data.priceAnnual,
      grantsFeatureKey: data.grantsFeatureKey?.trim() || null,
      grantsType: data.grantsType || null,
      grantsValue: data.grantsValue?.trim() || null,
      limitMode: data.limitMode ?? "ADDITIVE",
      isPublic: data.isPublic ?? true,
      isActive: data.isActive ?? true,
      billingDeferred: data.billingDeferred ?? (data.pricingModel === "USAGE" || data.pricingModel === "CUSTOM"),
      sortOrder: data.sortOrder ?? 0,
      plans: data.planIds?.length ? { connect: data.planIds.map((id) => ({ id })) } : undefined,
    },
  });
  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "CREATE", resource: "AddOn", resourceId: addOn.id,
    metadata: { slug: addOn.slug, grantsFeatureKey: addOn.grantsFeatureKey, pricingModel: data.pricingModel },
    organizationId: session.organizationId,
  });
  revalidatePath(ROUTES.adminAddOns);
  return serialize(addOn);
}

/** Update an add-on. `planIds` (when provided) replaces the plan set. */
export async function adminUpdateAddOn(addOnId: string, data: Partial<AddOnInput>) {
  const session = await requirePermission("billing:admin");
  if (data.grantsFeatureKey !== undefined) validateGrant(data.grantsFeatureKey, data.grantsType, data.grantsValue);
  const addOn = await db.addOn.update({
    where: { id: addOnId },
    data: {
      nameEn: data.nameEn?.trim(),
      nameAr: data.nameAr?.trim(),
      descriptionEn: data.descriptionEn === undefined ? undefined : data.descriptionEn?.trim() || null,
      descriptionAr: data.descriptionAr === undefined ? undefined : data.descriptionAr?.trim() || null,
      pricingModel: data.pricingModel,
      priceMonthly: data.priceMonthly,
      priceAnnual: data.priceAnnual,
      grantsFeatureKey: data.grantsFeatureKey === undefined ? undefined : data.grantsFeatureKey?.trim() || null,
      grantsType: data.grantsType === undefined ? undefined : data.grantsType || null,
      grantsValue: data.grantsValue === undefined ? undefined : data.grantsValue?.trim() || null,
      limitMode: data.limitMode,
      isPublic: data.isPublic,
      isActive: data.isActive,
      billingDeferred: data.billingDeferred,
      sortOrder: data.sortOrder,
      plans: data.planIds ? { set: data.planIds.map((id) => ({ id })) } : undefined,
    },
  });
  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "UPDATE", resource: "AddOn", resourceId: addOn.id,
    metadata: { slug: addOn.slug },
    organizationId: session.organizationId,
  });
  revalidatePath(ROUTES.adminAddOns);
  return serialize(addOn);
}

/** List every add-on with its plan restrictions + active-purchase count. */
export async function adminGetAddOns() {
  await requirePermission("billing:admin");
  const addOns = await db.addOn.findMany({
    include: {
      plans: { select: { id: true, slug: true, nameEn: true } },
      _count: { select: { subscriptions: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return serialize(addOns);
}

/** Activate / deactivate an add-on (deactivating also stops it granting entitlements). */
export async function adminToggleAddOn(addOnId: string, isActive: boolean) {
  const session = await requirePermission("billing:admin");
  await db.addOn.update({ where: { id: addOnId }, data: { isActive } });
  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "UPDATE", resource: "AddOn", resourceId: addOnId,
    metadata: { isActive },
    organizationId: session.organizationId,
  });
  revalidatePath(ROUTES.adminAddOns);
  return { success: true };
}

// ── Tenant self-service ─────────────────────────────────────────────────────

/** Public + active add-ons applicable to the org's plan, plus which it already owns. */
export async function getAvailableAddOns() {
  const session = await requirePermission("billing:read");
  const orgId = session.organizationId;
  const sub = await db.subscription.findFirst({
    where: { organizationId: orgId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, planId: true, billingCycle: true },
  });
  if (!sub) return serialize({ addOns: [], owned: [], billingCycle: "MONTHLY" });

  const addOns = await db.addOn.findMany({
    where: {
      isActive: true,
      isPublic: true,
      // No plan restriction = available to all plans; else must include this plan.
      OR: [{ plans: { none: {} } }, { plans: { some: { id: sub.planId } } }],
    },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  });
  const owned = await db.subscriptionAddOn.findMany({
    where: { subscriptionId: sub.id, status: "ACTIVE" },
    select: { addOnId: true, quantity: true },
  });
  return serialize({ addOns, owned, billingCycle: sub.billingCycle });
}

/** Purchase (or update the quantity of) an add-on for the org's active subscription. */
export async function purchaseAddOn(addOnId: string, quantity = 1) {
  const session = await requirePermission("billing:write");
  const orgId = session.organizationId;
  const sub = await db.subscription.findFirst({
    where: { organizationId: orgId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) throw new Error("You need an active subscription before adding an add-on.");

  const addOn = await db.addOn.findUnique({ where: { id: addOnId }, include: { plans: { select: { id: true } } } });
  if (!addOn || !addOn.isActive || !addOn.isPublic) throw new Error("This add-on isn't available.");
  if (addOn.billingDeferred) throw new Error("This add-on is coming soon.");
  if (addOn.plans.length > 0 && !addOn.plans.some((p) => p.id === sub.planId)) {
    throw new Error("This add-on isn't available on your current plan.");
  }

  const qty = Math.max(1, Math.floor(quantity));
  const unitPrice = Number(sub.billingCycle === "ANNUAL" ? addOn.priceAnnual : addOn.priceMonthly);
  await db.subscriptionAddOn.upsert({
    where: { subscriptionId_addOnId: { subscriptionId: sub.id, addOnId } },
    create: {
      subscriptionId: sub.id, addOnId, quantity: qty,
      unitPriceAtPurchase: unitPrice, status: "ACTIVE", activatedAt: new Date(),
    },
    update: { quantity: qty, unitPriceAtPurchase: unitPrice, status: "ACTIVE", activatedAt: new Date(), canceledAt: null },
  });
  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "CREATE", resource: "SubscriptionAddOn", resourceId: addOnId,
    metadata: { addOnSlug: addOn.slug, quantity: qty, unitPriceAtPurchase: unitPrice },
    organizationId: orgId,
  });
  invalidateEntitlements(orgId);
  revalidatePath(ROUTES.billing);
  return { success: true };
}

/** Cancel an active add-on (entitlement reverts immediately). */
export async function cancelAddOn(addOnId: string) {
  const session = await requirePermission("billing:write");
  const orgId = session.organizationId;
  const sub = await db.subscription.findFirst({
    where: { organizationId: orgId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!sub) throw new Error("No active subscription.");
  const existing = await db.subscriptionAddOn.findUnique({
    where: { subscriptionId_addOnId: { subscriptionId: sub.id, addOnId } },
  });
  if (!existing || existing.status !== "ACTIVE") throw new Error("This add-on isn't active.");

  await db.subscriptionAddOn.update({
    where: { id: existing.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
  logAuditEvent({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: "UPDATE", resource: "SubscriptionAddOn", resourceId: addOnId,
    metadata: { action: "canceled" },
    organizationId: orgId,
  });
  invalidateEntitlements(orgId);
  revalidatePath(ROUTES.billing);
  return { success: true };
}
