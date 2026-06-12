import { requirePermission } from "../../../lib/auth-helpers";
import { parseRangeParams } from "../../../lib/dashboard-range";
import { getLeasingStats } from "../../actions/dashboard-leasing";
import { getPipelineTrend } from "../../actions/trends/getPipelineTrend";
import { getRoleTaskQueue } from "../../actions/role-task-queue";
import LeasingView from "./LeasingView";

/**
 * Leasing dashboard — Server Component. Fetches all KPIs/trends server-side in
 * one render (no client mount-time waterfall). The date dimension is URL-synced
 * (§6.10.1): the picker writes `?from=&to=`, this page re-renders with the new
 * window. Audience (tenant-only) is already enforced by `dashboard/layout.tsx`
 * → requireTenant; the action-level `requirePermission` here fails fast.
 */
export default async function LeasingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("dashboard:read");
  const range = parseRangeParams(await searchParams);

  const [stats, pipelineTrend, taskQueue] = await Promise.all([
    getLeasingStats(range),
    getPipelineTrend(),
    getRoleTaskQueue(),
  ]);

  return (
    <LeasingView
      stats={stats}
      pipelineTrend={pipelineTrend}
      taskQueue={taskQueue}
      loadedAt={new Date().toISOString()}
    />
  );
}
