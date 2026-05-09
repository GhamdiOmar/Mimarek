import { getTenantPortalSummary } from "../actions/portal";
import PortalClient from "./PortalClient";

export default async function TenantPortalPage() {
  const summary = await getTenantPortalSummary().catch(() => null);

  return <PortalClient initialSummary={summary} />;
}
