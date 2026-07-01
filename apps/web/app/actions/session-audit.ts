"use server";

import { auth } from "../../auth";
import { logAuditEvent } from "../../lib/audit";

/**
 * Best-effort audit write for a client-side idle sign-out (IDLE-011).
 * Session-inactivity-timeout Phase 1 — see
 * `future-plans/session-inactivity-timeout-gap-action-plan.md`.
 *
 * Records that the CURRENT user's OWN session idled out. Deliberately does
 * NOT touch `tokenVersion` or any revocation state — that would sign out
 * every device, not just the idle browser (see AGENTS.md). Identity is read
 * server-side via `auth()`, never trusted from the caller — only the
 * inactivity duration is caller-supplied metadata.
 *
 * Fire-and-forget by contract: the caller must not await this before
 * signing the user out client-side, and a missing/expired session here is a
 * silent no-op (the sign-out may already be racing ahead of this call).
 */
// eslint-disable-next-line mimaric/require-action-guard -- self-service audit write for the caller's OWN already-authenticated session (no elevated data access); identity is read server-side via auth(), not trusted from the client. Mirrors the recordConsent exemption.
export async function recordIdleTimeout(metadata: { idleMinutes: number }): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user?.id) return;

    logAuditEvent({
      userId: session.user.id,
      userEmail: session.user.email ?? "",
      userRole: session.user.role,
      action: "SESSION_IDLE_TIMEOUT",
      resource: "Auth",
      organizationId: session.user.organizationId ?? null,
      metadata,
    });
  } catch {
    // Best-effort — never block or fail the idle sign-out on audit-write errors.
  }
}
