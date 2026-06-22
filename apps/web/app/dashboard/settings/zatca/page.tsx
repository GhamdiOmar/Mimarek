import { getTenantPageAccess } from "../../../../lib/auth-helpers";
import { AccessDenied } from "../../_components/AccessDenied";
import { getTenantEgsSummary } from "../../../actions/zatca/tenant-onboarding";
import { getTenantTaxConfig, getTenantBranches } from "../../../actions/zatca/tenant-config";
import TenantZatcaView from "./TenantZatcaView";

/**
 * Track-B ZATCA tenant config surface — Server Component.
 *
 * Audience (tenant-only) is enforced by `dashboard/layout.tsx` → requireTenant;
 * `getTenantPageAccess("zatca:config")` re-checks at the route level and renders
 * `<AccessDenied>` for tenant roles that lack this permission, rather than throwing
 * a generic error (§8.3 Layer 2, §6.11.4 friendly errors).
 */
export default async function TenantZatcaPage() {
  const access = await getTenantPageAccess("zatca:config", "/dashboard/settings/zatca");
  if (!access.allowed) return <AccessDenied />;

  const [summary, taxConfig, branches] = await Promise.all([
    getTenantEgsSummary(),
    getTenantTaxConfig(),
    getTenantBranches(),
  ]);

  return <TenantZatcaView summary={summary} taxConfig={taxConfig} branches={branches} />;
}
