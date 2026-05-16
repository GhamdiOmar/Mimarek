import { auth } from "../../auth";
import { isSystemRole } from "../../lib/permissions";
import { requireSystem, requireTenant } from "../../lib/auth-helpers";
import DashboardClientLayout from "./DashboardClientLayout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const raw = await auth();
  const role = raw?.user?.role ?? "";

  // System users (SYSTEM_ADMIN / SYSTEM_SUPPORT) are scoped to /dashboard/admin/*.
  // requireTenant() would redirect them straight back here → infinite loop.
  // requireSystem() validates they're authenticated and have a system role; the
  // nested admin/layout.tsx re-runs requireSystem() as the real access gate.
  const session = isSystemRole(role)
    ? await requireSystem()
    : await requireTenant();

  return (
    <DashboardClientLayout session={session}>
      {children}
    </DashboardClientLayout>
  );
}
