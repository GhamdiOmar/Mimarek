import { getTenantPageAccess } from "../../../lib/auth-helpers";
import { getUnitsWithBuildings } from "../../actions/units";
import { orgUsageSnapshot } from "../../../lib/server/org-usage";
import { FEATURE_KEYS } from "../../../lib/entitlements/keys";
import { AccessDenied } from "../_components/AccessDenied";
import UnitsView from "./UnitsView";

/**
 * Units — Server Component. Fetches the initial unit list server-side in one
 * render (no client mount-time fetch waterfall). Audience (tenant-only) is
 * already enforced by `dashboard/layout.tsx` → requireTenant.
 * `getTenantPageAccess("units:read")` renders an in-shell AccessDenied message
 * for a tenant role that lacks the permission, instead of throwing a generic error.
 *
 * All interactivity (DataTable, filters, search, create/edit/delete dialogs,
 * bulk actions, density toggle, mobile cards) lives in the `UnitsView` client
 * component, which seeds its `units` state from `initialUnits` and keeps the
 * existing optimistic-update mechanism for mutations.
 */
export default async function UnitsPage() {
  const access = await getTenantPageAccess("units:read");
  if (!access.allowed) return <AccessDenied />;

  const initialUnits = await getUnitsWithBuildings();

  // CX-002: pre-render the units.max usage so the user sees the cap (and the
  // create affordance disables) BEFORE filling the form, instead of the server
  // action throwing. `limit = null` means unlimited.
  const usage = await orgUsageSnapshot(access.session.organizationId);
  const u = usage.find((m) => m.key === FEATURE_KEYS.UNITS_MAX);
  const unitsUsage = u ? { current: u.current, limit: u.limit } : null;

  return <UnitsView initialUnits={initialUnits} unitsUsage={unitsUsage} />;
}
