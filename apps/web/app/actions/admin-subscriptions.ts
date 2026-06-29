"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEventAwait } from "../../lib/audit";
import { invalidateEntitlements } from "../../lib/entitlements";
import { transitionSubscription } from "../../lib/payment/subscription-machine";
import { mrrForCycle } from "../../lib/payment/mrr";
import { orgUsageSnapshot } from "../../lib/server/org-usage";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { getSubscriptionOrThrow, eventCategoryForDelta } from "../../lib/payment/admin-subscription-helpers";

// ═══════════════════════════════════════════════════════════════════════════
// Admin (platform) subscription management — pricing P3.
//
// All actions are gated by `billing:admin`, which is SYSTEM_ONLY: requirePermission
// rejects any tenant role for it (§8.4 permissions≠audience is satisfied because
// the permission itself is platform-only). The audit `organizationId` is the
// actor's (null for system staff), with the affected org in `targetOrgId`
// metadata — matching the existing adminCreateOverride convention.
//
// Helpers (getSubscriptionOrThrow / eventCategoryForDelta) live in a SEPARATE
// plain module because a `"use server"` file may export only async functions (§4).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Change an org's plan (cross-tenant). Unlike tenant `changePlan`, this allows
 * any plan (no `isPublic` guard) so admins can assign internal/enterprise plans.
 * Recomputes `priceAtRenewal` + `mrrSar` and logs an MRR-categorized event.
 */
export async function adminChangeOrgPlan(
  subscriptionId: string,
  newPlanId: string,
  billingCycle?: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL",
) {
  const session = await requirePermission("billing:admin");
  const sub = await getSubscriptionOrThrow(subscriptionId);
  const newPlan = await db.plan.findUnique({ where: { id: newPlanId } });
  if (!newPlan) throw new Error("The selected plan was not found. Refresh and try again.");

  const cycle = billingCycle ?? sub.billingCycle;
  const newPrice = Number(cycle === "ANNUAL" ? newPlan.priceAnnual : newPlan.priceMonthly);
  const oldMrr =
    sub.mrrSar != null ? Number(sub.mrrSar) : mrrForCycle(Number(sub.priceAtRenewal ?? 0), sub.billingCycle);
  const newMrr = mrrForCycle(newPrice, cycle);
  const delta = Math.round((newMrr - oldMrr) * 100) / 100;

  await db.$transaction([
    db.subscription.update({
      where: { id: subscriptionId },
      data: { planId: newPlanId, billingCycle: cycle, priceAtRenewal: newPrice, mrrSar: newMrr },
    }),
    db.subscriptionEvent.create({
      data: {
        subscriptionId,
        fromStatus: sub.status,
        toStatus: sub.status,
        triggeredBy: `admin:${session.userId}`,
        reason: `Admin changed plan to ${newPlan.slug}`,
        eventCategory: eventCategoryForDelta(delta) ?? undefined,
        mrrDeltaSar: delta,
        metadata: { previousPlanId: sub.planId, newPlanId, billingCycle: cycle },
      },
    }),
  ]);

  await logAuditEventAwait({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Subscription",
    resourceId: subscriptionId,
    metadata: { targetOrgId: sub.organizationId, previousPlanId: sub.planId, newPlanId, billingCycle: cycle, mrrDeltaSar: delta },
    organizationId: session.organizationId,
  });

  invalidateEntitlements(sub.organizationId);
  revalidatePath(ROUTES.adminSubscriptions);
  return { success: true };
}

/**
 * Set a custom negotiated `priceAtRenewal` (enterprise deals). No status change;
 * recomputes `mrrSar` and logs a categorized event. A reason is mandatory.
 */
export async function adminSetCustomPrice(subscriptionId: string, priceAtRenewal: number, reason: string) {
  const session = await requirePermission("billing:admin");
  if (!Number.isFinite(priceAtRenewal) || priceAtRenewal < 0) {
    throw new Error("Enter a valid price (zero or greater).");
  }
  if (!reason?.trim()) throw new Error("Add a reason for the custom price.");
  const sub = await getSubscriptionOrThrow(subscriptionId);

  const oldMrr =
    sub.mrrSar != null ? Number(sub.mrrSar) : mrrForCycle(Number(sub.priceAtRenewal ?? 0), sub.billingCycle);
  const newMrr = mrrForCycle(priceAtRenewal, sub.billingCycle);
  const delta = Math.round((newMrr - oldMrr) * 100) / 100;

  await db.$transaction([
    db.subscription.update({
      where: { id: subscriptionId },
      data: { priceAtRenewal, mrrSar: newMrr },
    }),
    db.subscriptionEvent.create({
      data: {
        subscriptionId,
        fromStatus: sub.status,
        toStatus: sub.status,
        triggeredBy: `admin:${session.userId}`,
        reason: `Custom price: ${reason.trim()}`,
        eventCategory: eventCategoryForDelta(delta) ?? undefined,
        mrrDeltaSar: delta,
        metadata: { priceAtRenewal, reason: reason.trim() },
      },
    }),
  ]);

  await logAuditEventAwait({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Subscription",
    resourceId: subscriptionId,
    metadata: { targetOrgId: sub.organizationId, priceAtRenewal, reason: reason.trim(), mrrDeltaSar: delta },
    organizationId: session.organizationId,
  });

  invalidateEntitlements(sub.organizationId);
  revalidatePath(ROUTES.adminSubscriptions);
  return { success: true };
}

/** Pause an ACTIVE subscription. `transitionSubscription` logs the event + busts entitlements. */
export async function adminPauseSubscription(subscriptionId: string, reason?: string) {
  const session = await requirePermission("billing:admin");
  const sub = await getSubscriptionOrThrow(subscriptionId);
  if (sub.status !== "ACTIVE") throw new Error("Only an active subscription can be paused.");

  await transitionSubscription(subscriptionId, "PAUSED", `admin:${session.userId}`, reason || "Admin pause");

  await logAuditEventAwait({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Subscription",
    resourceId: subscriptionId,
    metadata: { targetOrgId: sub.organizationId, action: "paused", reason },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.adminSubscriptions);
  return { success: true };
}

/** Resume a PAUSED subscription back to ACTIVE. */
export async function adminResumeSubscription(subscriptionId: string) {
  const session = await requirePermission("billing:admin");
  const sub = await getSubscriptionOrThrow(subscriptionId);
  if (sub.status !== "PAUSED") throw new Error("Only a paused subscription can be resumed.");

  await transitionSubscription(subscriptionId, "ACTIVE", `admin:${session.userId}`, "Admin resume");

  await logAuditEventAwait({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Subscription",
    resourceId: subscriptionId,
    metadata: { targetOrgId: sub.organizationId, action: "resumed" },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.adminSubscriptions);
  return { success: true };
}

/** Cancel a subscription (terminal). */
export async function adminCancelSubscription(subscriptionId: string, reason?: string) {
  const session = await requirePermission("billing:admin");
  const sub = await getSubscriptionOrThrow(subscriptionId);
  if (sub.status === "CANCELED") throw new Error("This subscription is already canceled.");

  await transitionSubscription(subscriptionId, "CANCELED", `admin:${session.userId}`, reason || "Admin cancellation");

  await logAuditEventAwait({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Subscription",
    resourceId: subscriptionId,
    metadata: { targetOrgId: sub.organizationId, action: "canceled", reason },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.adminSubscriptions);
  return { success: true };
}

/**
 * Combined drawer context: the plan list (for the change-plan picker) + the org
 * usage snapshot, in ONE action / ONE response. Single sequential RPC — the
 * counts inside `orgUsageSnapshot` are deliberately sequential (a concurrent
 * `Promise.all` of pooled queries deadlocks the Supabase pooler; see that file).
 */
export async function adminGetSubscriptionContext(organizationId: string) {
  await requirePermission("billing:admin");
  const plans = await db.plan.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, nameEn: true, nameAr: true },
  });
  const usage = await orgUsageSnapshot(organizationId);
  return serialize({ plans, usage });
}
