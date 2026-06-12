import { requirePermission } from "../../../lib/auth-helpers";
import { getUnitsWithBuildings } from "../../actions/units";
import UnitsView from "./UnitsView";

/**
 * Units — Server Component. Fetches the initial unit list server-side in one
 * render (no client mount-time fetch waterfall). Audience (tenant-only) is
 * already enforced by `dashboard/layout.tsx` → requireTenant; the
 * action-level `requirePermission("units:read")` here fails fast and matches
 * the permission the underlying `getUnitsWithBuildings()` action enforces.
 *
 * All interactivity (DataTable, filters, search, create/edit/delete dialogs,
 * bulk actions, density toggle, mobile cards) lives in the `UnitsView` client
 * component, which seeds its `units` state from `initialUnits` and keeps the
 * existing optimistic-update mechanism for mutations.
 */
export default async function UnitsPage() {
  await requirePermission("units:read");
  const initialUnits = await getUnitsWithBuildings();

  return <UnitsView initialUnits={initialUnits} />;
}
