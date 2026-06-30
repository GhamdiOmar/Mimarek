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

/** A single active add-on's grant of one featureKey (from SubscriptionAddOn × AddOn). */
export type AddOnGrant = {
  type: string;                       // EntitlementType: BOOLEAN | LIMIT | METERED
  value: string;                      // "true" | numeric string | "unlimited"
  quantity: number;                   // SubscriptionAddOn.quantity (≥1)
  limitMode: "ADDITIVE" | "OVERRIDE"; // ADDITIVE = plan + Σ; OVERRIDE = replace plan
};

export type OrgEntitlementData = {
  planSlug: string | null;
  planEntitlements: Record<string, { type: string; value: string }>;
  overrides: Record<string, { type: string; value: string; expiresAt: Date | null }>;
  // Active add-ons grouped by the featureKey they grant. Optional so existing
  // fixtures/constructors without add-ons still resolve (treated as none).
  addOns?: Record<string, AddOnGrant[]>;
  subscriptionStatus: string | null;
};

function intOr0(v: string): number {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Build the `addOns` map for `OrgEntitlementData` from active `SubscriptionAddOn`
 * rows (each with its `addOn` included). Skips add-ons that are inactive or carry
 * no grant. Pure — shared by the cached (`entitlements.ts`) and uncached
 * (`org-usage.ts`) entitlement fetchers so both resolve add-ons identically.
 */
export function buildAddOnGrants(
  rows: Array<{
    quantity: number;
    addOn: {
      grantsFeatureKey: string | null;
      grantsType: string | null;
      grantsValue: string | null;
      limitMode: string;
      isActive: boolean;
    };
  }>
): Record<string, AddOnGrant[]> {
  const map: Record<string, AddOnGrant[]> = {};
  for (const r of rows) {
    const a = r.addOn;
    if (!a.isActive || !a.grantsFeatureKey || !a.grantsType || a.grantsValue == null) continue;
    (map[a.grantsFeatureKey] ??= []).push({
      type: a.grantsType,
      value: a.grantsValue,
      quantity: Math.max(1, r.quantity),
      limitMode: a.limitMode === "OVERRIDE" ? "OVERRIDE" : "ADDITIVE",
    });
  }
  return map;
}

/**
 * Combine a plan entitlement with any active add-ons into one effective
 * {type, value, source}, or `null` when neither grants the feature.
 *
 * - BOOLEAN: granted if the plan OR any add-on grants `true`.
 * - LIMIT/OVERRIDE: the add-on value replaces the plan value (most generous wins).
 * - LIMIT/ADDITIVE (default): effective = planBase + Σ(addOn.value × quantity);
 *   `unlimited` on either side stays unlimited.
 * Pure — the override tier is handled by `resolveEntitlement` before this runs.
 */
export function mergePlanAndAddOns(
  planEnt: { type: string; value: string } | undefined,
  addOns: AddOnGrant[]
): { type: string; value: string; source: "plan" | "addon" } | null {
  if (!planEnt && addOns.length === 0) return null;
  const type = planEnt?.type ?? addOns[0]!.type;

  if (type === "BOOLEAN") {
    const planTrue = planEnt?.value === "true";
    const addonTrue = addOns.some((a) => a.value === "true");
    const granted = planTrue || addonTrue;
    return { type: "BOOLEAN", value: granted ? "true" : "false", source: !planTrue && addonTrue ? "addon" : "plan" };
  }

  if (type === "LIMIT") {
    // OVERRIDE add-ons replace the plan value entirely (most generous wins).
    const overrides = addOns.filter((a) => a.limitMode === "OVERRIDE");
    if (overrides.length > 0) {
      if (overrides.some((a) => a.value === "unlimited")) return { type: "LIMIT", value: "unlimited", source: "addon" };
      return { type: "LIMIT", value: String(Math.max(...overrides.map((a) => intOr0(a.value)))), source: "addon" };
    }
    // ADDITIVE: plan base + Σ(value × quantity). `unlimited` either side → unlimited.
    if (planEnt?.value === "unlimited") return { type: "LIMIT", value: "unlimited", source: "plan" };
    const additive = addOns.filter((a) => a.limitMode === "ADDITIVE");
    if (additive.some((a) => a.value === "unlimited")) return { type: "LIMIT", value: "unlimited", source: "addon" };
    const planBase = planEnt ? intOr0(planEnt.value) : 0;
    const addSum = additive.reduce((s, a) => s + intOr0(a.value) * Math.max(1, a.quantity), 0);
    return { type: "LIMIT", value: String(planBase + addSum), source: addSum > 0 ? "addon" : "plan" };
  }

  // METERED / unknown: pass the plan (else add-on) value through unchanged.
  return { type, value: planEnt?.value ?? addOns[0]!.value, source: planEnt ? "plan" : "addon" };
}

/**
 * Resolve an entitlement check against already-fetched org entitlement data.
 *
 * Priority: No subscription → deny · Override → Add-on ∪ Plan → Deny
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

  // Check override first (enterprise deals) — replaces both plan and add-ons
  const override = data.overrides[featureKey];
  if (override) {
    return evaluateEntitlement(featureKey, override.type, override.value, currentUsage, "override");
  }

  // Merge plan entitlement with any active add-ons (add-on > plan)
  const merged = mergePlanAndAddOns(data.planEntitlements[featureKey], data.addOns?.[featureKey] ?? []);
  if (merged) {
    return evaluateEntitlement(featureKey, merged.type, merged.value, currentUsage, merged.source);
  }

  // Not in plan, no add-on, no override → deny
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
  source: "override" | "plan" | "addon"
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
