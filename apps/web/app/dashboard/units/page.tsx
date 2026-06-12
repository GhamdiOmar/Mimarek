import { getTenantPageAccess } from "../../../lib/auth-helpers";
import { getUnitsWithBuildings } from "../../actions/units";
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

  return <UnitsView initialUnits={initialUnits} />;
}
