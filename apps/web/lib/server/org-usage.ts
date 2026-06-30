import { db } from "@repo/db";
import { FEATURE_KEYS } from "../entitlements";
import { resolveEntitlement, buildAddOnGrants, type OrgEntitlementData } from "../entitlements/evaluator";

export type OrgUsageMetric = {
  key: string;
  labelAr: string;
  labelEn: string;
  current: number;
  limit: number | null;
};

/**
 * Fetch an org's entitlement data DIRECTLY (uncached) — the same shape
 * `lib/entitlements`'s cached path builds, but without `unstable_cache`.
 *
 * Uncached on purpose: the admin subscriptions drawer requests an ARBITRARY
 * tenant's usage, and the entitlement cache is keyed per-org — warming some
 * other org's cache from a platform-admin session is wasteful, and an admin
 * reviewing a subscription wants live numbers, not a 60s-stale snapshot.
 */
async function fetchOrgEntitlementData(orgId: string): Promise<OrgEntitlementData> {
  // Sequential (see orgUsageSnapshot note) — keep this single request's pooled
  // queries serialized rather than fanned out concurrently.
  const subscription = await db.subscription.findFirst({
    where: { organizationId: orgId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
    include: { plan: { include: { entitlements: true } } },
  });
  const overrides = await db.entitlementOverride.findMany({
    where: { organizationId: orgId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });
  const addOnRows = subscription
    ? await db.subscriptionAddOn.findMany({
        where: { subscriptionId: subscription.id, status: "ACTIVE" },
        include: { addOn: true },
      })
    : [];

  const planEntitlements: Record<string, { type: string; value: string }> = {};
  for (const e of subscription?.plan.entitlements ?? []) {
    planEntitlements[e.featureKey] = { type: e.type, value: e.value };
  }
  const overrideMap: Record<string, { type: string; value: string; expiresAt: Date | null }> = {};
  for (const o of overrides) {
    overrideMap[o.featureKey] = { type: o.type, value: o.value, expiresAt: o.expiresAt };
  }
  return {
    planSlug: subscription?.plan.slug ?? null,
    planEntitlements,
    overrides: overrideMap,
    addOns: buildAddOnGrants(addOnRows),
    subscriptionStatus: subscription?.status ?? null,
  };
}

/**
 * Usage-vs-limit snapshot for an org's absolute-count LIMIT entitlements.
 * Shared by the tenant billing page (`getOrgUsageSnapshot`) and the admin
 * subscriptions drawer (`adminGetOrgUsage`) so the metric list lives in ONE
 * place. `limit = null` means unlimited. The marketplace-listing count uses the
 * SAME predicate as the publish gate, so the meter and the cap always agree.
 *
 * Plain server helper (NOT "use server") — each caller applies its own auth
 * guard (tenant `billing:read` vs platform `billing:admin`).
 */
export async function orgUsageSnapshot(orgId: string): Promise<OrgUsageMetric[]> {
  // SEQUENTIAL, not Promise.all (deliberate). These 4 counts + the nested
  // deep-include entitlement fetch run one after another so a single request
  // never fans a burst of concurrent queries at the pooled connection. The cost
  // is a few ms; the payoff is predictable, contention-free behaviour.
  const users = await db.user.count({ where: { organizationId: orgId } });
  const units = await db.unit.count({ where: { organizationId: orgId } });
  const customers = await db.customer.count({ where: { organizationId: orgId } });
  const listings = await db.marketplaceListing.count({
    where: { sellerOrgId: orgId, status: { in: ["PENDING_REVIEW", "PUBLISHED"] } },
  });
  const entData = await fetchOrgEntitlementData(orgId);
  const metrics = [
    { key: FEATURE_KEYS.USERS_MAX, labelAr: "المستخدمون", labelEn: "Users", current: users },
    { key: FEATURE_KEYS.UNITS_MAX, labelAr: "الوحدات", labelEn: "Units", current: units },
    { key: FEATURE_KEYS.CUSTOMERS_MAX, labelAr: "العملاء", labelEn: "Customers", current: customers },
    {
      key: FEATURE_KEYS.MARKETPLACE_LISTINGS_MAX,
      labelAr: "إعلانات السوق",
      labelEn: "Marketplace listings",
      current: listings,
    },
  ];
  return metrics.map((m) => {
    const ent = resolveEntitlement(entData, m.key, m.current);
    const limit = ent.limit === undefined || ent.limit === Infinity ? null : ent.limit;
    return { key: m.key, labelAr: m.labelAr, labelEn: m.labelEn, current: m.current, limit };
  });
}
