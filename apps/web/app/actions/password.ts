"use server";

import { db } from "@repo/db";
import { hash as bcryptHash, compare as bcryptCompare } from "@node-rs/bcrypt";
import { randomBytes } from "crypto";
import { getSessionOrThrow } from "../../lib/auth-helpers";
import { validatePassword } from "../../lib/password-policy";
import { logAuditEvent } from "../../lib/audit";
import { getAppUrl } from "../../lib/app-url";
import { sendTransactionalEmail } from "../../lib/email";
import { passwordResetEmail } from "../../lib/email-templates";
import { checkRateLimit } from "../../lib/rate-limit";

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

  // Hash and save
  const hashed = await bcryptHash(data.newPassword, 12);
  await db.user.update({ where: { id: user.id }, data: { password: hashed } });

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

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit check (before DB lookup to prevent timing-based enumeration)
  const rl = await checkRateLimit(`pwreset:${normalizedEmail}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) {
    return { success: true };
  }

  const user = await db.user.findUnique({ where: { email: normalizedEmail } });

  // Always return success to avoid email enumeration
  if (!user) {
    return { success: true };
  }

  // Generate token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  const resetUrl = `${getAppUrl()}/auth/reset-password?token=${token}`;
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

export async function resetPassword(token: string, newPassword: string) {
  const resetToken = await db.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken) {
    return { error: "INVALID_TOKEN" };
  }

  if (resetToken.usedAt) {
    return { error: "TOKEN_USED" };
  }

  if (new Date() > resetToken.expiresAt) {
    return { error: "TOKEN_EXPIRED" };
  }

  // Validate new password
  const validation = validatePassword(newPassword, {
    name: resetToken.user.name ?? undefined,
    email: resetToken.user.email,
  });
  if (!validation.valid) {
    return { error: "WEAK_PASSWORD", details: validation.errors };
  }

  // Hash and save
  const hashed = await bcryptHash(newPassword, 12);
  await db.user.update({ where: { id: resetToken.userId }, data: { password: hashed } });

  // Mark token as used
  await db.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } });

  logAuditEvent({
    userId: resetToken.user.id,
    userEmail: resetToken.user.email,
    userRole: resetToken.user.role,
    action: "PASSWORD_RESET",
    resource: "Auth",
    organizationId: resetToken.user.organizationId,
  });

  return { success: true };
}
