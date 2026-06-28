import * as React from "react";
import { getTenantFeatureAccess } from "../../../lib/auth-helpers";
import { UpgradeGate } from "../../../components/entitlements";
import { MaintenanceTabs } from "./MaintenanceTabs";

/**
 * Maintenance section layout — Server Component. Gates the ENTIRE section
 * (overview / tickets / preventive / detail) on the `cmms.access` plan flag
 * (pricing P2): a non-entitled org sees the `<UpgradeGate>` instead of the tab
 * nav + content, so there is no read-only leak via the tabs. The client tab-nav
 * lives in `MaintenanceTabs` (it needs `usePathname`). Audience (tenant-only) is
 * enforced upstream by `dashboard/layout.tsx → requireTenant`.
 */
export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getTenantFeatureAccess("cmms.access");
  if (!access.allowed) {
    return <UpgradeGate result={access.entitlement} featureNameAr="الصيانة" featureNameEn="Maintenance" />;
  }

  return (
    <div>
      <MaintenanceTabs />
      {children}
    </div>
  );
}
