import { requireSystem } from "../../../../lib/auth-helpers";
import { getGatewayConfigSummary } from "../../../actions/payment/gateway-config";
import IntegrationsView from "./IntegrationsView";

/**
 * Platform "Integrations" surface — Server Component.
 *
 * Audience (system-only) is enforced by `dashboard/admin/layout.tsx` →
 * `requireSystem()`; we re-assert it here (defense-in-depth, CLAUDE.md §8.3
 * Layer 2). The data fetch goes through `getGatewayConfigSummary()`, which itself
 * gates on the SYSTEM-only `billing:admin` permission and returns only the
 * secret-free summary DTO (presence booleans + non-secret mode/flags — never a
 * decrypted key). Mirrors the ZATCA admin page pattern.
 */
export default async function IntegrationsPage() {
  await requireSystem();
  const summary = await getGatewayConfigSummary();
  return <IntegrationsView summary={summary} />;
}
