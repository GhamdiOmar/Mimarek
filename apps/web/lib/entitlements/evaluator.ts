// ─── Pure entitlement evaluator ──────────────────────────────────────────────
// Zero runtime dependencies — no db, no next/*. Safe to unit-test in isolation.

// ─── Entitlement Check Result ────────────────────────────────────────────────

export type EntitlementResult = {
  granted: boolean;
  reason?: string;
  limit?: number;        // For LIMIT type: the max allowed
  currentUsage?: number; // For LIMIT type: current count
  remaining?: number;    // For LIMIT type: limit - currentUsage
  upgradeRequired?: boolean;
  featureKey: string;
};

export type OrgEntitlementData = {
  planSlug: string | null;
  planEntitlements: Record<string, { type: string; value: string }>;
  overrides: Record<string, { type: string; value: string; expiresAt: Date | null }>;
  subscriptionStatus: string | null;
};

/**
 * Resolve an entitlement check against already-fetched org entitlement data.
 *
 * Priority: No subscription → deny · Override → Plan Entitlement → Deny
 */
export function resolveEntitlement(
  data: OrgEntitlementData,
  featureKey: string,
  currentUsage?: number
): EntitlementResult {
  // If no active subscription at all, deny everything
  if (!data.subscriptionStatus) {
    return {
      granted: false,
      reason: "No active subscription",
      upgradeRequired: true,
      featureKey,
    };
  }

  // Check override first (enterprise deals)
  const override = data.overrides[featureKey];
  if (override) {
    return evaluateEntitlement(featureKey, override.type, override.value, currentUsage, "override");
  }

  // Check plan entitlement
  const planEnt = data.planEntitlements[featureKey];
  if (planEnt) {
    return evaluateEntitlement(featureKey, planEnt.type, planEnt.value, currentUsage, "plan");
  }

  // Not in plan and no override → deny
  return {
    granted: false,
    reason: "Feature not included in current plan",
    upgradeRequired: true,
    featureKey,
  };
}

export function evaluateEntitlement(
  featureKey: string,
  type: string,
  value: string,
  currentUsage: number | undefined,
  source: "override" | "plan"
): EntitlementResult {
  switch (type) {
    case "BOOLEAN": {
      const granted = value === "true";
      return {
        granted,
        reason: granted ? undefined : `Feature disabled on current ${source === "override" ? "override" : "plan"}`,
        upgradeRequired: !granted,
        featureKey,
      };
    }
    case "LIMIT": {
      const limit = value === "unlimited" ? Infinity : parseInt(value, 10);
      if (isNaN(limit)) {
        return { granted: false, reason: "Invalid limit configuration", featureKey };
      }
      if (limit === Infinity) {
        return { granted: true, limit: Infinity, currentUsage, featureKey };
      }
      const usage = currentUsage ?? 0;
      const remaining = Math.max(0, limit - usage);
      return {
        granted: usage < limit,
        limit,
        currentUsage: usage,
        remaining,
        reason: usage >= limit ? `Limit reached (${usage}/${limit})` : undefined,
        upgradeRequired: usage >= limit,
        featureKey,
      };
    }
    case "METERED": {
      // Metered features always grant access but track usage
      return { granted: true, featureKey };
    }
    default:
      return { granted: false, reason: `Unknown entitlement type: ${type}`, featureKey };
  }
}
