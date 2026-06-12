import { redirect } from "next/navigation";
import { getSessionOrThrow } from "../../lib/auth-helpers";
import { isSystemRole } from "../../lib/permissions";
import { parseRangeParams } from "../../lib/dashboard-range";
import {
  getDashboardV3Stats,
  getDashboardRecentDeals,
  getDashboardUpcomingPayments,
  getDashboardMaintenanceSummary,
} from "../actions/dashboard";
import { getOccupancyTrend } from "../actions/trends/getOccupancyTrend";
import { getPipelineTrend } from "../actions/trends/getPipelineTrend";
import { getCollectionsTrend } from "../actions/trends/getCollectionsTrend";
import { getTicketsTrend } from "../actions/trends/getTicketsTrend";
import { getRoleTaskQueue } from "../actions/role-task-queue";
import DashboardView from "./DashboardView";

/**
 * Index dashboard — Server Component. Runs role-redirect server-side
 * (no client flash) then fetches all 9 data sources in a single
 * Promise.all before rendering. The date dimension is URL-synced
 * (§6.10.1): the picker writes `?from=&to=`, this page re-renders and
 * the range scopes the one period (flow) metric — Monthly Revenue.
 * Other tiles are current-state and intentionally not window-bound.
 *
 * Audience: TENANT only (ADMIN / MANAGER / USER).
 * System users → /dashboard/admin (server redirect, no flash).
 * Role-specific users → their dedicated dashboard (server redirect).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // ── Layer 2: role-based redirect (server-side, no flash) ───────────
  const session = await getSessionOrThrow();
  const role = session.role;

  if (isSystemRole(role)) redirect("/dashboard/admin");

  const roleRoute: Record<string, string> = {
    LEASING: "/dashboard/leasing",
    AGENT: "/dashboard/leasing",
    FINANCE: "/dashboard/finance",
    TECHNICIAN: "/dashboard/maintenance",
  };
  const target = roleRoute[role];
  if (target) redirect(target);

  // ── Data fetch (ADMIN / MANAGER / USER fall through here) ──────────
  const range = parseRangeParams(await searchParams);
  const [stats, deals, payments, maintenance, occupancyTrend, pipelineTrend, collectionsTrend, ticketsTrend, taskQueue] =
    await Promise.all([
      getDashboardV3Stats(range),
      getDashboardRecentDeals(),
      getDashboardUpcomingPayments(),
      getDashboardMaintenanceSummary(),
      getOccupancyTrend(),
      getPipelineTrend(),
      getCollectionsTrend(),
      getTicketsTrend(),
      getRoleTaskQueue(),
    ]);

  return (
    <DashboardView
      stats={stats}
      deals={deals}
      payments={payments}
      maintenance={maintenance}
      trends={{
        units: occupancyTrend,
        pipeline: pipelineTrend,
        collections: collectionsTrend,
        tickets: ticketsTrend,
      }}
      taskQueue={taskQueue}
      userName={session.name ?? ""}
      loadedAt={new Date().toISOString()}
    />
  );
}
