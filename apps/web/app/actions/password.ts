"use server";

import { db, Prisma } from "@repo/db";
import { hash as bcryptHash, compare as bcryptCompare } from "@node-rs/bcrypt";
import { randomBytes } from "crypto";
import { getSessionOrThrow } from "../../lib/auth-helpers";
import { validatePassword } from "../../lib/password-policy";
import { logAuditEvent } from "../../lib/audit";
import { getAppUrl } from "../../lib/app-url";
import { sendTransactionalEmail } from "../../lib/email";
import { passwordResetEmail } from "../../lib/email-templates";
import { checkRateLimit } from "../../lib/rate-limit";
import { sha256Hex } from "../../lib/token-hash";

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const session = await getSessionOrThrow();

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.password) {
    return { error: "USER_NOT_FOUND" };
  }

  // Verify current password
  const isValid = await bcryptCompare(data.currentPassword, user.password);
  if (!isValid) {
    return { error: "WRONG_PASSWORD" };
  }

  // Check new password is different
  const isSame = await bcryptCompare(data.newPassword, user.password);
  if (isSame) {
    return { error: "SAME_PASSWORD" };
  }

  // Validate new password
  const validation = validatePassword(data.newPassword, { name: user.name ?? undefined, email: user.email });
  if (!validation.valid) {
    return { error: "WEAK_PASSWORD", details: validation.errors };
  }

  // Hash and save. Bump tokenVersion so every existing JWT for this user is
  // invalidated on its next action (SEC-003 — a password change signs out other
  // sessions, the standard account-security behaviour).
  const hashed = await bcryptHash(data.newPassword, 12);
  await db.user.update({
    where: { id: user.id },
    data: { password: hashed, tokenVersion: { increment: 1 } },
  });

  logAuditEvent({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    action: "PASSWORD_CHANGE",
    resource: "Auth",
    organizationId: user.organizationId,
  });

  return { success: true };
}

// eslint-disable-next-line mimaric/require-action-guard -- public pre-auth: a locked-out user requests a reset; responds uniformly to avoid account enumeration.
export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit check (before DB lookup to prevent timing-based enumeration)
  const rl = await checkRateLimit(`password-reset:${normalizedEmail}`, 3, 60 * 60 * 1000, { failClosed: true });
  if (!rl.allowed) {
    return { success: true };
  }

  const user = await db.user.findUnique({ where: { email: normalizedEmail } });

  // Always return success to avoid email enumeration
  if (!user) {
    return { success: true };
  }

  // Generate token. The RAW token (URL-safe) is emailed ONLY in the link; we
  // persist ONLY its SHA-256 hash (OWASP: hash-at-rest), so a DB read cannot
  // forge a valid reset link.
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.passwordResetToken.create({
    data: {
      tokenHash: sha256Hex(rawToken),
      userId: user.id,
      expiresAt,
    },
  });

  const resetUrl = `${getAppUrl()}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
  const template = passwordResetEmail({ name: user.name, resetUrl });
  const emailResult = await sendTransactionalEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  logAuditEvent({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    action: "PASSWORD_RESET_REQUEST",
    resource: "Auth",
    metadata: { emailSent: emailResult.ok, emailCode: emailResult.code },
    organizationId: user.organizationId,
  });

  return { success: true };
}

// eslint-disable-next-line mimaric/require-action-guard -- token-gated pre-auth: the hashed reset token IS the credential (user is locked out, has no session).
export async function resetPassword(token: string, newPassword: string) {
  // Look up by HASH of the incoming token — only the hash is stored at rest.
  const tokenHash = sha256Hex(token);
  const now = new Date();

  // (a) Pre-check lookup (also gives us the user for password validation).
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  // (b) Cheap rejections before any write.
  if (!row) {
    return { error: "INVALID_TOKEN" };
  }
  if (row.usedAt) {
    return { error: "TOKEN_USED" };
  }
  if (row.expiresAt <= now) {
    return { error: "TOKEN_EXPIRED" };
  }

  // (c) Validate the new password BEFORE consuming the token — a weak password
  // must NOT burn the token (the link stays usable for a retry).
  const validation = validatePassword(newPassword, {
    name: row.user.name ?? undefined,
    email: row.user.email,
  });
  if (!validation.valid) {
    return { error: "WEAK_PASSWORD", details: validation.errors };
  }

  // (d) Atomic single-use claim + password update in ONE transaction. The
  // updateMany(usedAt: null, expiresAt > now) lets exactly one caller win the
  // race; count !== 1 means it was already consumed (double-spend closed).
  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      return { error: "TOKEN_USED" as const };
    }
    await tx.user.update({
      where: { id: row.userId },
      // Bump tokenVersion so any outstanding JWT for this account is invalidated
      // after a reset (SEC-003 — a stolen session cannot survive a password reset).
      data: { password: await bcryptHash(newPassword, 12), tokenVersion: { increment: 1 } },
    });
    return { success: true as const };
  });

  if ("error" in result) {
    return result;
  }

  // (e) Fire-and-forget audit (unchanged).
  logAuditEvent({
    userId: row.user.id,
    userEmail: row.user.email,
    userRole: row.user.role,
    action: "PASSWORD_RESET",
    resource: "Auth",
    organizationId: row.user.organizationId,
  });

  return { success: true };
}
