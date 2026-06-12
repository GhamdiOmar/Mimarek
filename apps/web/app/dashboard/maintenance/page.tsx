import { requirePermission } from "../../../lib/auth-helpers";
import { parseRangeParams } from "../../../lib/dashboard-range";
import { getMaintenanceStats } from "../../actions/dashboard-maintenance";
import { getTicketsTrend } from "../../actions/trends/getTicketsTrend";
import { getRoleTaskQueue } from "../../actions/role-task-queue";
import MaintenanceView from "./MaintenanceView";

/**
 * Maintenance dashboard — Server Component. Fetches all KPIs/trends server-side
 * in one render (no client mount-time waterfall). The date dimension is URL-synced
 * (§6.10.1): the picker writes `?from=&to=`, this page re-renders with the new
 * window. Audience (tenant-only) is already enforced by `dashboard/layout.tsx`
 * → requireTenant; the action-level `requirePermission` here fails fast.
 */
export default async function MaintenanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("dashboard:read");
  const range = parseRangeParams(await searchParams);

  const [stats, ticketsTrend, taskQueue] = await Promise.all([
    getMaintenanceStats(range),
    getTicketsTrend(),
    getRoleTaskQueue(),
  ]);

  return (
    <MaintenanceView
      stats={stats}
      ticketsTrend={ticketsTrend}
      taskQueue={taskQueue}
      loadedAt={new Date().toISOString()}
    />
  );
}
