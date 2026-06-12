import { startOfMonth, endOfDay } from "date-fns";
import { requireSystem } from "../../../lib/auth-helpers";
import { parseRangeParams } from "../../../lib/dashboard-range";
import { adminGetPlatformStats } from "../../actions/admin-stats";
import { getMrrTrend } from "../../actions/trends/getMrrTrend";
import { getNetNewArr } from "../../actions/admin-analytics/getNetNewArr";
import { getArrWaterfall } from "../../actions/admin-analytics/getArrWaterfall";
import { getArAging } from "../../actions/admin-analytics/getArAging";
import { getCollectedVsBilled } from "../../actions/admin-analytics/getCollectedVsBilled";
import { getFailedPaymentArrAtRisk } from "../../actions/admin-analytics/getFailedPaymentArrAtRisk";
import { getZatcaClearanceRate } from "../../actions/admin-analytics/getZatcaClearanceRate";
import { getTopArrConcentration } from "../../actions/admin-analytics/getTopArrConcentration";
import { getDiscountLeakage } from "../../actions/admin-analytics/getDiscountLeakage";
import { getTrialToPaidConversion } from "../../actions/admin-analytics/getTrialToPaidConversion";
import { getPlatformRiskInputs } from "../../actions/admin-analytics/getPlatformRiskInputs";
import AdminView from "./AdminView";

/**
 * Platform Admin dashboard — Server Component. Fetches all ARR / risk / scale
 * KPIs and trends server-side in one render (no client mount-time waterfall).
 *
 * Audience (system-only) is enforced by `dashboard/admin/layout.tsx`
 * → `requireSystem()`; we re-assert it here (defense-in-depth, CLAUDE.md §8.3
 * Layer 2) and the action-level `requirePermission("billing:admin")` — a
 * SYSTEM_ONLY permission — fails fast for any non-system caller. We deliberately
 * do NOT call `requirePermission("dashboard:read")`: that permission is
 * tenant-scoped and would throw for SYSTEM_ADMIN / SYSTEM_SUPPORT.
 *
 * The date dimension is URL-synced (§6.10.1): the picker writes `?from=&to=`,
 * this page re-renders with the new window. When the params are absent we
 * default to month-to-date — identical to the previous client `useDateRangeQuery`
 * default (`startOfMonth(now)` → `endOfDay(now)`) — so the displayed default
 * window is unchanged.
 */
export default async function SystemAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireSystem();

  const now = new Date();
  // Match the legacy client default exactly: MTD = month-start → end-of-today.
  const range = parseRangeParams(await searchParams) ?? {
    from: startOfMonth(now),
    to: endOfDay(now),
  };

  const [
    netNew,
    waterfall,
    aging,
    collected,
    atRisk,
    zatca,
    concentration,
    leakage,
    trial,
    risk,
    stats,
    mrrTrend,
  ] = await Promise.all([
    getNetNewArr(range),
    getArrWaterfall(range),
    getArAging(range),
    getCollectedVsBilled(range),
    getFailedPaymentArrAtRisk(range),
    getZatcaClearanceRate(range),
    getTopArrConcentration(range),
    getDiscountLeakage(range),
    getTrialToPaidConversion(range),
    getPlatformRiskInputs(),
    adminGetPlatformStats(),
    getMrrTrend(),
  ]);

  return (
    <AdminView
      netNew={netNew}
      waterfall={waterfall}
      aging={aging}
      collected={collected}
      atRisk={atRisk}
      zatca={zatca}
      concentration={concentration}
      leakage={leakage}
      trial={trial}
      risk={risk}
      stats={stats}
      mrrTrend={mrrTrend}
      loadedAt={new Date().toISOString()}
    />
  );
}
