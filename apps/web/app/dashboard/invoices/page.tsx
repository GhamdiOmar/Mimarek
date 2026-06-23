import { requireTenant } from "../../../lib/auth-helpers";
import { getTenantInvoices } from "../../actions/zatca/tenant-invoices";
import InvoicesView from "./InvoicesView";

/**
 * Tenant ZATCA documents list (Track C / R4b) — `payments:read`, TENANT audience.
 * The edge gate + `ROUTE_GUARDS` already gate this route; `requireTenant()` re-asserts
 * defense-in-depth (§8.3 Layer 2) before any data read.
 */
export default async function InvoicesPage() {
  await requireTenant();

  const { documents, health } = await getTenantInvoices();

  return <InvoicesView documents={documents} health={health} />;
}
