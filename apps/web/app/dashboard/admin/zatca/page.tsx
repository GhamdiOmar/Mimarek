import { requireSystem } from "../../../../lib/auth-helpers";
import { getPlatformEgsSummary } from "../../../actions/zatca/onboarding";
import ZatcaAdminView from "./ZatcaAdminView";

/**
 * Track-A ZATCA platform surface — Server Component.
 *
 * Audience (system-only) is enforced by `dashboard/admin/layout.tsx` →
 * `requireSystem()`; we re-assert it here (defense-in-depth, CLAUDE.md §8.3
 * Layer 2). The data fetch goes through `getPlatformEgsSummary()`, which itself
 * gates on the SYSTEM_ONLY `zatca:admin` permission and returns only the
 * EGS_PUBLIC_SELECT DTO (no secret/key material, D13).
 */
export default async function ZatcaAdminPage() {
  await requireSystem();
  const { egs, logs } = await getPlatformEgsSummary();
  return <ZatcaAdminView egs={egs} logs={logs} />;
}
