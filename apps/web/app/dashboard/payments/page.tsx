import type { ComponentProps } from "react";
import { requirePermission } from "../../../lib/auth-helpers";
import { getInstallments } from "../../actions/installments";
import PaymentsView from "./PaymentsView";

/**
 * Payments — Server Component (CX-003 pt1). Fetches the rent-installment list
 * server-side so the page arrives already filled (no client mount-fetch
 * waterfall). Permission matches `getInstallments` (`finance:read`). The
 * interactive client body (record payment, bulk mark-paid, filters, saved
 * views) lives in PaymentsView.
 */
export default async function PaymentsPage() {
  await requirePermission("finance:read");
  const initialInstallments = (await getInstallments()) as unknown as ComponentProps<
    typeof PaymentsView
  >["initialInstallments"];

  return <PaymentsView initialInstallments={initialInstallments} />;
}
