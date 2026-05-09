"use server";

import { db } from "@repo/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getSessionOrThrow } from "../../lib/auth-helpers";
import { validatePassword } from "../../lib/password-policy";
import { logAuditEvent } from "../../lib/audit";
import { getAppUrl } from "../../lib/app-url";
import { sendTransactionalEmail } from "../../lib/email";
import { passwordResetEmail } from "../../lib/email-templates";

/**
 * In-memory rate limiter for password reset requests.
 * Limit: 3 requests per email per hour.
 *
 * NOTE: This Map is per-process and resets on deploy. For multi-instance
 * deployments, replace with Redis-backed rate limiting (@upstash/ratelimit).
 */
const resetAttempts = new Map<string, { count: number; firstAttempt: number }>();
const RESET_RATE_LIMIT = 3;
const RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkResetRateLimit(email: string): boolean {
  const entry = resetAttempts.get(email);
  if (!entry) return false;
  const now = Date.now();
  if (now - entry.firstAttempt > RESET_WINDOW_MS) {
    resetAttempts.delete(email);
    return false;
  }
  return entry.count >= RESET_RATE_LIMIT;
}

function recordResetAttempt(email: string) {
  const entry = resetAttempts.get(email);
  const now = Date.now();
  if (!entry || now - entry.firstAttempt > RESET_WINDOW_MS) {
    resetAttempts.set(email, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
  }
}

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
  const isValid = await bcrypt.compare(data.currentPassword, user.password);
  if (!isValid) {
    return { error: "WRONG_PASSWORD" };
  }

  // Check new password is different
  const isSame = await bcrypt.compare(data.newPassword, user.password);
  if (isSame) {
    return { error: "SAME_PASSWORD" };
  }

  // Validate new password
  const validation = validatePassword(data.newPassword, { name: user.name ?? undefined, email: user.email });
  if (!validation.valid) {
    return { error: "WEAK_PASSWORD", details: validation.errors };
  }

  // Hash and save
  const hashed = await bcrypt.hash(data.newPassword, 12);
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
  if (checkResetRateLimit(normalizedEmail)) {
    return { success: true };
  }
  recordResetAttempt(normalizedEmail);

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
  const hashed = await bcrypt.hash(newPassword, 12);
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
