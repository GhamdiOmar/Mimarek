"use server";

import { db } from "@repo/db";
import type { SubscriptionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEventAwait } from "../../lib/audit";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { notifyScheduledPlanChange } from "../../lib/billing-notifications";

// ═══════════════════════════════════════════════════════════════════════════
// Scheduled plan changes — pricing P5. Platform admin (billing:admin, SYSTEM).
// Schedules a future re-price / migration for the cohort of subscriptions on a
// source plan; the cron (apply-scheduled-plan-changes) applies it at the cutoff.
// ═══════════════════════════════════════════════════════════════════════════

const COHORT_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

/** Schedule a future plan/price change. Announces immediately if `announceAt` is null/past. */
export async function adminSchedulePlanChange(data: {
  sourcePlanId: string;
  changeType: "PRICE_ONLY" | "PLAN_MIGRATION";
  targetPlanId?: string | null;
  newPriceMonthly?: number | null;
  newPriceAnnual?: number | null;
  effectiveAt: string; // ISO datetime
  announceAt?: string | null;
  grandfatherUntil?: string | null;
  reason?: string;
  notes?: string;
}) {
  const session = await requirePermission("billing:admin");

  const effectiveAt = new Date(data.effectiveAt);
  if (Number.isNaN(effectiveAt.getTime()) || effectiveAt.getTime() <= Date.now()) {
    throw new Error("The effective date must be in the future.");
  }
  if (data.changeType === "PLAN_MIGRATION" && !data.targetPlanId) {
    throw new Error("Choose a target plan for a migration.");
  }
  if (data.changeType === "PRICE_ONLY" && data.newPriceMonthly == null && data.newPriceAnnual == null) {
    throw new Error("Enter a new monthly or annual price.");
  }
  // Reject a negative price; a provided price applies only to its own cycle (a
  // null cycle is left unchanged), so a monthly-only edit can't zero annual subs.
  if (
    (data.newPriceMonthly != null && data.newPriceMonthly < 0) ||
    (data.newPriceAnnual != null && data.newPriceAnnual < 0)
  ) {
    throw new Error("Price can't be negative.");
  }
  const announceAt = data.announceAt ? new Date(data.announceAt) : null;
  const grandfatherUntil = data.grandfatherUntil ? new Date(data.grandfatherUntil) : null;
  if (grandfatherUntil && grandfatherUntil.getTime() < effectiveAt.getTime()) {
    throw new Error("Grandfather date can't be before the effective date.");
  }

  const change = await db.scheduledPlanChange.create({
    data: {
      sourcePlanId: data.sourcePlanId,
      changeType: data.changeType,
      targetPlanId: data.changeType === "PLAN_MIGRATION" ? data.targetPlanId : null,
      newPriceMonthly: data.changeType === "PRICE_ONLY" ? data.newPriceMonthly ?? null : null,
      newPriceAnnual: data.changeType === "PRICE_ONLY" ? data.newPriceAnnual ?? null : null,
      effectiveAt,
      announceAt,
      grandfatherUntil,
      reason: data.reason?.trim() || null,
      notes: data.notes?.trim() || null,
      createdBy: `admin:${session.userId}`,
    },
    include: { sourcePlan: true, targetPlan: true },
  });

  const affectedCount = await db.subscription.count({
    where: { planId: data.sourcePlanId, status: { in: COHORT_STATUSES } },
  });

  await logAuditEventAwait({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "ScheduledPlanChange",
    resourceId: change.id,
    metadata: {
      sourcePlanId: data.sourcePlanId,
      targetPlanId: change.targetPlanId,
      changeType: data.changeType,
      effectiveAt: effectiveAt.toISOString(),
      affectedCount,
    },
    organizationId: session.organizationId,
  });

  // Announce immediately when announceAt is null or already due (else the cron's
  // announce pass fires it when announceAt arrives).
  if (!announceAt || announceAt.getTime() <= Date.now()) {
    const orgs = await db.subscription.findMany({
      where: { planId: data.sourcePlanId, status: { in: COHORT_STATUSES } },
      select: { organizationId: true },
      distinct: ["organizationId"],
    });
    for (const { organizationId } of orgs) {
      await notifyScheduledPlanChange(organizationId, {
        sourcePlanNameEn: change.sourcePlan.nameEn,
        sourcePlanNameAr: change.sourcePlan.nameAr,
        targetPlanNameEn: change.targetPlan?.nameEn ?? null,
        targetPlanNameAr: change.targetPlan?.nameAr ?? null,
        effectiveAt: change.grandfatherUntil ?? change.effectiveAt,
        isMigration: change.changeType === "PLAN_MIGRATION",
      });
    }
    await db.scheduledPlanChange.update({ where: { id: change.id }, data: { status: "ANNOUNCED" } });
  }

  revalidatePath(ROUTES.adminScheduledPlanChanges);
  return serialize({ ...change, affectedCount });
}

/** Cancel a not-yet-applied scheduled change. */
export async function adminCancelScheduledChange(id: string) {
  const session = await requirePermission("billing:admin");
  const change = await db.scheduledPlanChange.findUnique({ where: { id } });
  if (!change) throw new Error("Scheduled change not found.");
  if (change.status !== "SCHEDULED" && change.status !== "ANNOUNCED") {
    throw new Error("Only a scheduled or announced change can be canceled.");
  }
  await db.scheduledPlanChange.update({ where: { id }, data: { status: "CANCELED" } });
  await logAuditEventAwait({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "ScheduledPlanChange",
    resourceId: id,
    metadata: { action: "canceled" },
    organizationId: session.organizationId,
  });
  revalidatePath(ROUTES.adminScheduledPlanChanges);
  return { success: true };
}

/** List all scheduled changes; pending ones carry a live blast-radius `previewCount`. */
export async function adminListScheduledChanges() {
  await requirePermission("billing:admin");
  const changes = await db.scheduledPlanChange.findMany({
    include: {
      sourcePlan: { select: { id: true, slug: true, nameEn: true, nameAr: true } },
      targetPlan: { select: { id: true, slug: true, nameEn: true, nameAr: true } },
    },
    orderBy: [{ effectiveAt: "asc" }],
  });
  // Sequential (not Promise.all) — concurrent pooled counts can deadlock the pooler.
  const withCounts: Array<(typeof changes)[number] & { previewCount: number | null }> = [];
  for (const c of changes) {
    let previewCount: number | null = null;
    if (c.status === "SCHEDULED" || c.status === "ANNOUNCED") {
      previewCount = await db.subscription.count({
        where: { planId: c.sourcePlanId, status: { in: COHORT_STATUSES } },
      });
    }
    withCounts.push({ ...c, previewCount });
  }
  return serialize(withCounts);
}
