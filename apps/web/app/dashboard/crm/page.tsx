import { getTenantPageAccess } from "../../../lib/auth-helpers";
import { getCustomers } from "../../actions/customers";
import { getTeamMembers } from "../../actions/team";
import { getAvailableUnitsForInterest } from "../../actions/customer-interests";
import { AccessDenied } from "../_components/AccessDenied";
import CrmView from "./CrmView";

/**
 * CRM — Server Component. Fetches the initial CRM data server-side in one render
 * (no client mount-time fetch waterfall). This mirrors the prior client
 * `loadData()` exactly: the SAME masked `getCustomers()` (PII is masked
 * server-side in the action via `maskCustomerPii` — see actions/customers.ts),
 * plus team members and available units for the add/link flows.
 *
 * Audience (tenant-only) is already enforced by `dashboard/layout.tsx`
 * → requireTenant. `getTenantPageAccess("crm:read")` renders an in-shell
 * AccessDenied message for a tenant role that lacks CRM access (FINANCE /
 * TECHNICIAN / USER) instead of throwing a generic error. The underlying `getCustomers()` action
 * additionally enforces `customers:read_pii` to decide masking — unchanged.
 *
 * All interactivity (Kanban + drag-to-change-stage, MobileKanban, customer
 * drawer, add/edit dialogs, search/filters, activity timeline) lives in the
 * `CrmView` client component, which seeds its state from these props and keeps
 * the existing optimistic-update + revalidatePath / client-refetch mechanisms
 * for mutations. CRM has its own filters — the dashboard date-range picker does
 * NOT apply here, so no range params are read.
 */
export default async function CRMPage() {
  const access = await getTenantPageAccess("crm:read");
  if (!access.allowed) return <AccessDenied />;

  const [initialCustomers, members, initialAvailableUnits] = await Promise.all([
    getCustomers(),
    getTeamMembers(),
    getAvailableUnitsForInterest(),
  ]);

  // Same client-side filter the previous mount-time loadData() applied to the
  // team list before seeding the agent dropdowns.
  const initialTeamMembers = members.filter((m) =>
    ["ADMIN", "MANAGER", "AGENT"].includes(m.role),
  );

  return (
    <CrmView
      initialCustomers={initialCustomers}
      initialTeamMembers={initialTeamMembers}
      initialAvailableUnits={initialAvailableUnits}
    />
  );
}
