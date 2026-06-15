import type { ComponentProps } from "react";
import { requirePermission } from "../../../lib/auth-helpers";
import { getContracts } from "../../actions/contracts";
import ContractsView from "./ContractsView";

/**
 * Contracts — Server Component (CX-003 pt1). Fetches the contract list
 * server-side in the initial render so the page arrives already filled — no
 * client mount-fetch waterfall. Permission matches `getContracts`
 * (`contracts:read`); customers/units stay lazily loaded in the client island
 * (only fetched when a create/edit modal opens, not on every page view).
 * The interactive client body lives in ContractsView.
 */
export default async function ContractsPage() {
  await requirePermission("contracts:read");
  // getContracts returns the rich Prisma row; the client island narrows it to
  // its local Contract shape (the same `data as Contract[]` narrowing the old
  // client mount-fetch did) — cast at this serialization boundary.
  const initialContracts = (await getContracts()) as unknown as ComponentProps<
    typeof ContractsView
  >["initialContracts"];

  return <ContractsView initialContracts={initialContracts} />;
}
