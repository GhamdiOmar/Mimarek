import { requirePermission } from "../../../lib/auth-helpers";
import ReportsView from "./ReportsView";

/**
 * Reports dashboard — Server Component.
 *
 * The reports page is a pure report-generator: there is no meaningful
 * "initial dashboard data" to server-fetch — all five report actions
 * (getRevenueReport, getOccupancyReport, getRentCollectionReport,
 * getMaintenanceReport, getMaintenanceCostReport) run only when the user
 * clicks PDF/Excel. Server-rendering them on every page load would be
 * wasteful and wrong (the user hasn't chosen a date range yet).
 *
 * What the Server Component does here:
 * 1. Enforces auth / permission gate server-side (fast-fail before HTML is
 *    sent) — previously absent; the old client component relied solely on
 *    the layout's requireTenant guard.
 * 2. Stamps loadedAt so the view can show a "last rendered" timestamp
 *    (pattern parity with FinanceView / LeaseView).
 * 3. Keeps the interactive export form, date inputs, and all report-action
 *    calls fully client-side inside ReportsView — nothing in that flow is
 *    changed.
 *
 * Audience: tenant-only (dashboard/layout.tsx → requireTenant + this gate).
 */
export default async function ReportsDashboardPage() {
  await requirePermission("reports:read");

  return <ReportsView loadedAt={new Date().toISOString()} />;
}
