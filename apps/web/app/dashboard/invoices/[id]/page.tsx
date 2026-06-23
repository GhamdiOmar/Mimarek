import { notFound } from "next/navigation";
import { requireTenant } from "../../../../lib/auth-helpers";
import { getTenantInvoice } from "../../../actions/zatca/tenant-invoices";
import InvoiceDetailView from "./InvoiceDetailView";

/**
 * Tenant ZATCA document detail (Track C / R4b) — `payments:read`, TENANT audience.
 * `requireTenant()` re-asserts the audience gate (§8.3 Layer 2); the action re-checks
 * org-ownership before returning. A missing/cross-org doc renders the 404 boundary.
 */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTenant();

  const { id } = await params;
  const doc = await getTenantInvoice(id);
  if (!doc) notFound();

  return <InvoiceDetailView doc={doc} />;
}
