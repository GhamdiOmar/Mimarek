import { requirePermission, getTenantFeatureAccess } from "../../../lib/auth-helpers";
import { UpgradeGate } from "../../../components/entitlements";
import { parseRangeParams } from "../../../lib/dashboard-range";
import { getFinanceStats } from "../../actions/dashboard-finance";
import { getCollectionsTrend } from "../../actions/trends/getCollectionsTrend";
import { getRevenueTrend } from "../../actions/trends/getRevenueTrend";
import { getRoleTaskQueue } from "../../actions/role-task-queue";
import FinanceView from "./FinanceView";

/**
 * Finance dashboard — Server Component. Fetches all KPIs/trends server-side in
 * one render (no client mount-time waterfall). The date dimension is URL-synced
 * (§6.10.1): the picker writes `?from=&to=`, this page re-renders with the new
 * window. Audience (tenant-only) is already enforced by `dashboard/layout.tsx`
 * → requireTenant; the action-level `requirePermission` here fails fast.
 */
export default async function FinanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("dashboard:read");
  // Plan gate: the Finance dashboard is a Professional+ feature (§ pricing P1/P2).
  const access = await getTenantFeatureAccess("finance.access");
  if (!access.allowed) {
    return <UpgradeGate result={access.entitlement} featureNameAr="لوحة التمويل" featureNameEn="Finance dashboard" />;
  }
  const range = parseRangeParams(await searchParams);

  const [stats, collectionsTrend, revenueTrend, taskQueue] = await Promise.all([
    getFinanceStats(range),
    getCollectionsTrend(),
    getRevenueTrend(),
    getRoleTaskQueue(),
  ]);

  return (
    <FinanceView
      stats={stats}
      collectionsTrend={collectionsTrend}
      revenueTrend={revenueTrend}
      taskQueue={taskQueue}
      loadedAt={new Date().toISOString()}
    />
  );
}
