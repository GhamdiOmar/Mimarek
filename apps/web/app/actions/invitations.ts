"use server";

import { db, Prisma, type User, type UserRole } from "@repo/db";
import crypto from "crypto";
import { hash as bcryptHash } from "@node-rs/bcrypt";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../lib/routes";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { createNotification } from "../../lib/create-notification";
import { validatePassword } from "../../lib/password-policy";
import { isSystemRole } from "../../lib/permissions";
import { signIn } from "../../auth";
import { getAppUrl } from "../../lib/app-url";
import { sendTransactionalEmail } from "../../lib/email";
import { invitationEmail } from "../../lib/email-templates";
import { checkLimit, FEATURE_KEYS } from "../../lib/entitlements";
import { checkRateLimit, peekRateLimit } from "../../lib/rate-limit";
import { sha256Hex } from "../../lib/token-hash";

// ─── Error helper ─────────────────────────────────────────────────────────────

/** Extract a human-readable message from an unknown thrown value (module-private). */
function errorMessage(err: unknown): string | undefined {
  return err instanceof Error ? err.message : undefined;
}

/**
 * Mirror the original `meta.target?.includes(field)` check. Prisma types
 * `meta.target` as `unknown`; at runtime a P2002 carries either a `string[]`
 * (column list) or a single `string` — both expose `.includes`.
 */
function targetIncludes(target: unknown, field: string): boolean {
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === "string") return target.includes(field);
  return false;
}

// ─── Invitation Rate Limiter ─────────────────────────────────────────────────

/**
 * Postgres-backed invitation rate limiter.
 * Limit: 10 invitations per organization per hour.
 * Fails open on DB error — a Postgres hiccup never blocks legitimate invites.
 */
const INVITE_RATE_LIMIT = 10;
const INVITE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Read-only gate — returns true if the org is already over the limit. */
async function checkInviteRateLimit(orgId: string): Promise<boolean> {
  const result = await peekRateLimit(`invite:${orgId}`, INVITE_RATE_LIMIT);
  return !result.allowed;
}

/** Increment the counter after a successful invite creation. */
async function recordInviteAttempt(orgId: string): Promise<void> {
  await checkRateLimit(`invite:${orgId}`, INVITE_RATE_LIMIT, INVITE_WINDOW_MS);
}

// ─── Create Invitation ────────────────────────────────────────────────────────

export async function createInvitation(data: { email: string; role?: string }) {
  try {
    const session = await requirePermission("team:write");

    // Rate limit check (Postgres-backed; fails open on DB error)
    if (await checkInviteRateLimit(session.organizationId)) {
      return { success: false, error: "Too many invitations. Please try again later." };
    }

    const email = data.email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: "Invalid email address" };
    }

    // Guard: non-system users cannot invite with system roles
    if (data.role && isSystemRole(data.role) && !isSystemRole(session.role)) {
      return { success: false, error: "Cannot assign system-level roles" };
    }

    const userCount = await db.user.count({ where: { organizationId: session.organizationId } });
    const entitlement = await checkLimit(session.organizationId, FEATURE_KEYS.USERS_MAX, userCount);
    if (!entitlement.granted) {
      return { success: false, error: entitlement.reason ?? "Team member limit reached. Please upgrade your plan." };
    }

    // Check if email already belongs to an existing user
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return { success: false, error: "A user with this email already exists" };
    }

    // Check if already invited to this org with a pending invitation
    const existingInvitation = await db.invitation.findFirst({
      where: {
        email,
        organizationId: session.organizationId,
        status: "PENDING_INVITE",
      },
    });
    if (existingInvitation) {
      return { success: false, error: "An invitation has already been sent to this email" };
    }

    // The RAW token (random UUID) goes ONLY in the emailed invite URL below; the
    // DB `token` column now stores ONLY its SHA-256 hash (OWASP: hash-at-rest),
    // mirroring passwordResetToken.tokenHash. A DB read therefore cannot forge a
    // redeemable invite link.
    const rawToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await db.invitation.create({
      data: {
        email,
        token: sha256Hex(rawToken),
        role: (data.role || "USER") as UserRole,
        organizationId: session.organizationId,
        invitedById: session.userId,
        status: "PENDING_INVITE",
        expiresAt,
      },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    await recordInviteAttempt(session.organizationId);
    const inviteUrl = `${getAppUrl()}/auth/invite/${rawToken}`;
    const template = invitationEmail({
      inviteUrl,
      organizationName: invitation.organization.name,
      inviterName: invitation.invitedBy.name,
      role: invitation.role,
    });
    const emailResult = await sendTransactionalEmail({
      to: invitation.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "CREATE",
      resource: "Invitation",
      resourceId: invitation.id,
      metadata: { invitedEmail: email, role: data.role || "USER", emailSent: emailResult.ok, emailCode: emailResult.code },
      organizationId: session.organizationId,
    });

    revalidatePath(ROUTES.settingsTeam);

    return {
      success: true,
      inviteUrl,
      emailSent: emailResult.ok,
      emailMessage: emailResult.message,
    };
  } catch (error: unknown) {
    console.error("[Invitations] createInvitation error:", error);
    return { success: false, error: errorMessage(error) || "Failed to create invitation" };
  }
}

// ─── Accept Invitation ────────────────────────────────────────────────────────

// eslint-disable-next-line mimaric/require-action-guard -- token-gated pre-auth: the invite token IS the credential (the invitee has no session yet).
export async function acceptInvitation(data: {
  token: string;
  name: string;
  password: string;
}) {
  try {
    // Find invitation by HASH of the incoming token — only the hash is stored at rest.
    const invitation = await db.invitation.findFirst({
      where: { token: sha256Hex(data.token), status: "PENDING_INVITE" },
      include: {
        organization: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true } },
      },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found or has already been used" };
    }

    // Check expiry
    if (invitation.expiresAt < new Date()) {
      await db.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED_INVITE" },
      });
      return { success: false, error: "This invitation has expired" };
    }

    // Validate password strength
    const validation = validatePassword(data.password, {
      name: data.name,
      email: invitation.email,
    });
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.map((e) => e.en).join(" "),
      };
    }

    // Hash password OUTSIDE transaction (CPU-intensive)
    const hashedPassword = await bcryptHash(data.password, 12);

    // Atomic: create user + update invitation status
    let user: User;
    try {
      user = await db.$transaction(async (tx: Prisma.TransactionClient) => {
        // Re-check invitation status inside tx to prevent double-use
        const freshInvite = await tx.invitation.findUnique({
          where: { id: invitation.id },
        });
        if (!freshInvite || freshInvite.status !== "PENDING_INVITE") {
          throw new Error("This invitation has already been used. Please request a new invitation.");
        }

        const newUser = await tx.user.create({
          data: {
            name: data.name,
            email: invitation.email,
            password: hashedPassword,
            role: invitation.role,
            organizationId: invitation.organizationId,
            onboardingCompleted: true,
            // Accepting a tokenized invitation emailed to this address already
            // proves email control, so the account is verified on creation —
            // otherwise the auto-sign-in below would hit the new
            // EMAIL_NOT_VERIFIED gate (auth.ts) and lock the invitee out.
            emailVerified: new Date(),
            invitedVia: "invitation",
            invitedBy: invitation.invitedById,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED_INVITE",
            acceptedById: newUser.id,
            acceptedAt: new Date(),
          },
        });

        return newUser;
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "INVITATION_ALREADY_USED") {
        return { success: false, error: "Invitation has already been used" };
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        targetIncludes(error.meta?.target, "email")
      ) {
        return { success: false, error: "An account with this email already exists" };
      }
      throw error;
    }

    // Post-transaction: notification, audit, auto-sign-in
    await createNotification({
      userId: invitation.invitedById,
      type: "INVITATION_ACCEPTED",
      title: `${data.name} قبل الدعوة`,
      titleEn: `${data.name} accepted the invitation`,
      message: `${data.name} (${invitation.email}) انضم للمنظمة بنجاح`,
      messageEn: `${data.name} (${invitation.email}) has joined the organization`,
      link: "/dashboard/settings/team",
      organizationId: invitation.organizationId,
    });

    logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: "CREATE",
      resource: "User",
      resourceId: user.id,
      metadata: { invitationId: invitation.id, invitedVia: "invitation" },
      organizationId: invitation.organizationId,
    });

    // Auto-sign in
    await signIn("credentials", {
      email: invitation.email,
      password: data.password,
      redirect: false,
    });

    return { success: true, redirect: "/dashboard" };
  } catch (error: unknown) {
    console.error("[Invitations] acceptInvitation error:", error);
    return { success: false, error: errorMessage(error) || "Failed to accept invitation" };
  }
}

// ─── Get Invitation By Token ──────────────────────────────────────────────────

// eslint-disable-next-line mimaric/require-action-guard -- token-gated pre-auth read: the invite token IS the credential (invitee has no session yet).
export async function getInvitationByToken(token: string) {
  try {
    // Look up by HASH of the incoming token — only the hash is stored at rest.
    const invitation = await db.invitation.findFirst({
      where: { token: sha256Hex(token) },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (!invitation) {
      return { valid: false, error: "Invitation not found" };
    }

    if (invitation.status !== "PENDING_INVITE") {
      return { valid: false, error: "This invitation has already been used or revoked" };
    }

    if (invitation.expiresAt < new Date()) {
      return { valid: false, error: "This invitation has expired" };
    }

    return {
      valid: true,
      email: invitation.email,
      role: invitation.role,
      orgName: invitation.organization.name,
      inviterName: invitation.invitedBy.name,
    };
  } catch (error: unknown) {
    console.error("[Invitations] getInvitationByToken error:", error);
    return { valid: false, error: "Failed to validate invitation" };
  }
}

// ─── Get Org Invitations ──────────────────────────────────────────────────────

export async function getOrgInvitations() {
  try {
    const session = await requirePermission("team:read");

    return db.invitation.findMany({
      where: { organizationId: session.organizationId },
      include: {
        invitedBy: { select: { name: true } },
        acceptedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error: unknown) {
    console.error("[Invitations] getOrgInvitations error:", error);
    throw new Error("Unable to load invitations. Please refresh and try again.");
  }
}

// ─── Revoke Invitation ────────────────────────────────────────────────────────

export async function revokeInvitation(invitationId: string) {
  try {
    const session = await requirePermission("team:write");

    const invitation = await db.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId: session.organizationId,
        status: "PENDING_INVITE",
      },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found or already processed" };
    }

    await db.invitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED_INVITE" },
    });

    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "UPDATE",
      resource: "Invitation",
      resourceId: invitationId,
      metadata: { action: "revoked", email: invitation.email },
      organizationId: session.organizationId,
    });

    revalidatePath(ROUTES.settingsTeam);

    return { success: true };
  } catch (error: unknown) {
    console.error("[Invitations] revokeInvitation error:", error);
    return { success: false, error: errorMessage(error) || "Failed to revoke invitation" };
  }
}

// ─── Resend Invitation ────────────────────────────────────────────────────────

export async function resendInvitation(invitationId: string) {
  try {
    const session = await requirePermission("team:write");

    // Rate limit check (Postgres-backed; fails open on DB error)
    if (await checkInviteRateLimit(session.organizationId)) {
      return { success: false, error: "Too many invitations. Please try again later." };
    }

    const invitation = await db.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId: session.organizationId,
      },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    // Fresh raw token for the new emailed link; persist ONLY its SHA-256 hash
    // (OWASP: hash-at-rest), same as the create path above.
    const newRawToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const updatedInvitation = await db.invitation.update({
      where: { id: invitationId },
      data: {
        token: sha256Hex(newRawToken),
        expiresAt,
        status: invitation.status === "EXPIRED_INVITE" ? "PENDING_INVITE" : invitation.status,
      },
    });

    await recordInviteAttempt(session.organizationId);
    const inviteUrl = `${getAppUrl()}/auth/invite/${newRawToken}`;
    const template = invitationEmail({
      inviteUrl,
      organizationName: invitation.organization.name,
      inviterName: invitation.invitedBy.name,
      role: updatedInvitation.role,
      resend: true,
    });
    const emailResult = await sendTransactionalEmail({
      to: invitation.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "UPDATE",
      resource: "Invitation",
      resourceId: invitationId,
      metadata: { action: "resent", email: invitation.email, emailSent: emailResult.ok, emailCode: emailResult.code },
      organizationId: session.organizationId,
    });

    revalidatePath(ROUTES.settingsTeam);

    return {
      success: true,
      inviteUrl,
      emailSent: emailResult.ok,
      emailMessage: emailResult.message,
    };
  } catch (error: unknown) {
    console.error("[Invitations] resendInvitation error:", error);
    return { success: false, error: errorMessage(error) || "Failed to resend invitation" };
  }
}
