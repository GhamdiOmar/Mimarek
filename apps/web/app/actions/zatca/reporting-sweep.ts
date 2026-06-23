"use server";

import { requirePermission } from "../../../lib/auth-helpers";
import { logAuditEvent } from "../../../lib/audit";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../../lib/routes";
import { notifyPlatformStaff } from "../../../lib/create-notification";
import { runReportingSweepInternal, getReportingHealthInternal } from "../../../lib/zatca-reporting";

/**
 * Platform ZATCA reporting-sweep actions (Track C / R4b) — `zatca:admin` (SYSTEM_ONLY). The
 * orchestration lives in lib/zatca-reporting (server-only, unguarded); these are the guarded +
 * audited entry points the admin UI calls. The cron route calls the internal fn directly behind
 * the cron secret.
 */

/** Run the B2C reporting recovery sweep now (admin button), then raise the >12h stuck alarm. */
export async function runReportingSweep() {
  const session = await requirePermission("zatca:admin");

  const summary = await runReportingSweepInternal();
  const health = await getReportingHealthInternal(null);

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "TenantDocument",
    resourceId: "reporting-sweep",
    organizationId: session.organizationId,
    metadata: { ...summary, stuckOver12h: health.stuckOver12h },
  });

  if (health.stuckOver12h > 0) {
    await notifyPlatformStaff({
      type: "ZATCA_CLEARANCE",
      title: `${health.stuckOver12h} مستند عالق في الإبلاغ`,
      titleEn: `${health.stuckOver12h} document(s) stuck reporting`,
      message: "مستندات بقيت قيد المعالجة أكثر من 12 ساعة — يلزم المراجعة.",
      messageEn: "Documents have been pending for over 12 hours — review required.",
      link: ROUTES.adminZatca,
    });
  }

  revalidatePath(ROUTES.adminZatca);
  return { ...summary, stuckOver12h: health.stuckOver12h };
}

/** Platform-wide reporting health (admin ZATCA dashboard). */
export async function getReportingHealth() {
  await requirePermission("zatca:admin");
  return getReportingHealthInternal(null);
}
