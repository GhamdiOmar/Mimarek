import { db } from "@repo/db";
import { unstable_cache, revalidateTag } from "next/cache";
import { resolveEntitlement } from "./entitlements/evaluator";
import type { EntitlementResult, OrgEntitlementData } from "./entitlements/evaluator";

// Re-export the pure evaluator types so existing importers keep working.
export type { EntitlementResult, OrgEntitlementData } from "./entitlements/evaluator";

// ─── Feature Keys ────────────────────────────────────────────────────────────

/**
 * All feature keys used in the entitlement system.
 * Matches PlanEntitlement.featureKey values in the database.
 */
export const FEATURE_KEYS = {
  // Numeric limits
  USERS_MAX: "users.max",
  UNITS_MAX: "units.max",

  // Boolean features
  CMMS_ACCESS: "cmms.access",
  PLANNING_ACCESS: "planning.access",
  REPORTS_EXPORT: "reports.export",
  PII_ENCRYPTION: "pii.encryption",
  GIS_ACCESS: "gis.access",
  AUDIT_ACCESS: "audit.access",
  API_ACCESS: "api.access",
  CUSTOM_BRANDING: "custom.branding",

  // Tier-based
  SLA_PRIORITY: "sla.priority",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

// ─── Internal: Fetch org entitlements (cached) ──────────────────────────────

async function _fetchOrgEntitlements(orgId: string): Promise<OrgEntitlementData> {
  // Get active subscription with plan entitlements
  const subscription = await db.subscription.findFirst({
    where: {
      organizationId: orgId,
      status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      plan: {
        include: {
          entitlements: true,
        },
      },
    },
  });

  // Get overrides (checked first — enterprise deals override plan)
  const overrides = await db.entitlementOverride.findMany({
    where: {
      organizationId: orgId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  const planEntitlements: Record<string, { type: string; value: string }> = {};
  if (subscription?.plan.entitlements) {
    for (const ent of subscription.plan.entitlements) {
      planEntitlements[ent.featureKey] = {
        type: ent.type,
        value: ent.value,
      };
    }
  }

  const overrideMap: Record<string, { type: string; value: string; expiresAt: Date | null }> = {};
  for (const ov of overrides) {
    overrideMap[ov.featureKey] = {
      type: ov.type,
      value: ov.value,
      expiresAt: ov.expiresAt,
    };
  }

  return {
    planSlug: subscription?.plan.slug ?? null,
    planEntitlements,
    overrides: overrideMap,
    subscriptionStatus: subscription?.status ?? null,
  };
}

/**
 * Cached version — 60s TTL, invalidated via revalidateTag('entitlements')
 */
function getOrgEntitlementsCached(orgId: string) {
  return unstable_cache(
    () => _fetchOrgEntitlements(orgId),
    [`entitlements-${orgId}`],
    { tags: ["entitlements", `entitlements-${orgId}`], revalidate: 60 }
  )();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if an organization is entitled to a specific feature.
 *
 * Priority: Override → Plan Entitlement → Deny
 *
 * For LIMIT features, pass `currentUsage` to check if under the cap.
 * For BOOLEAN features, just check granted.
 */
export async function checkEntitlement(
  orgId: string,
  featureKey: string,
  currentUsage?: number
): Promise<EntitlementResult> {
  const data = await getOrgEntitlementsCached(orgId);
  return resolveEntitlement(data, featureKey, currentUsage);
}

// ─── Convenience Helpers ────────────────────────────────────────────────────

/**
 * Check a numeric limit entitlement against current DB count.
 * Automatically queries the count for the resource type.
 */
export async function checkLimit(
  orgId: string,
  featureKey: string,
  currentCount: number
): Promise<EntitlementResult> {
  return checkEntitlement(orgId, featureKey, currentCount);
}

/**
 * Require an entitlement or throw an error.
 * Use in server actions before creating resources.
 */
export async function requireEntitlement(
  orgId: string,
  featureKey: string,
  currentUsage?: number
): Promise<EntitlementResult> {
  const result = await checkEntitlement(orgId, featureKey, currentUsage);
  if (!result.granted) {
    throw new Error(
      result.reason || `Access denied: ${featureKey} not available on your current plan`
    );
  }
  return result;
}

/**
 * Get all entitlements for an organization (for dashboard display).
 */
export async function getOrgEntitlements(orgId: string) {
  return getOrgEntitlementsCached(orgId);
}

/**
 * Get the current subscription status for an org.
 */
export async function getSubscriptionStatus(orgId: string): Promise<string | null> {
  const data = await getOrgEntitlementsCached(orgId);
  return data.subscriptionStatus;
}

/**
 * Invalidate cached entitlements for an org (call after plan change, override, etc.)
 */
export async function invalidateEntitlements(orgId?: string) {
  if (orgId) {
    revalidateTag(`entitlements-${orgId}`, { expire: 0 });
  }
  revalidateTag("entitlements", { expire: 0 });
}
