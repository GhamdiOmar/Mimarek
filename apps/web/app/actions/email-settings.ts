"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "../../lib/routes";
import { requirePermission } from "../../lib/auth-helpers";
import { encrypt } from "../../lib/encryption";
import { getEmailSettings, sendTransactionalEmail } from "../../lib/email";
import { testEmail } from "../../lib/email-templates";
import { getAppUrl } from "../../lib/app-url";
import { logAuditEvent } from "../../lib/audit";

const emailSchema = z
  .string()
  .trim()
  .email()
  .or(z.literal(""))
  .transform((value) => value || null);

const saveEmailSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  emailFromName: z.string().trim().min(1).max(80),
  emailFromAddress: z.string().trim().email(),
  emailReplyTo: emailSchema,
  smtpHost: z.string().trim().min(1).max(120),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  smtpUsername: z.string().trim().min(1).max(180),
  smtpPassword: z.string().optional(),
  emailTestRecipient: emailSchema,
});

export async function getEmailSettingsAction() {
  await requirePermission("billing:admin");
  return getEmailSettings();
}

export async function saveEmailSettingsAction(raw: z.input<typeof saveEmailSettingsSchema>) {
  const session = await requirePermission("billing:admin");
  const data = saveEmailSettingsSchema.parse(raw);
  const trimmedPassword = data.smtpPassword?.trim();

  const passwordPatch = trimmedPassword
    ? {
        smtpPasswordEncrypted: encrypt(trimmedPassword),
        smtpPasswordLast4: trimmedPassword.slice(-4),
      }
    : {};

  await db.systemConfig.upsert({
    where: { id: "system" },
    create: {
      id: "system",
      emailProvider: "HOSTINGER_SMTP",
      emailEnabled: data.emailEnabled,
      emailFromName: data.emailFromName,
      emailFromAddress: data.emailFromAddress,
      emailReplyTo: data.emailReplyTo,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      smtpUsername: data.smtpUsername,
      emailTestRecipient: data.emailTestRecipient,
      ...passwordPatch,
    },
    update: {
      emailProvider: "HOSTINGER_SMTP",
      emailEnabled: data.emailEnabled,
      emailFromName: data.emailFromName,
      emailFromAddress: data.emailFromAddress,
      emailReplyTo: data.emailReplyTo,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      smtpUsername: data.smtpUsername,
      emailTestRecipient: data.emailTestRecipient,
      ...passwordPatch,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "SystemConfig",
    resourceId: "system",
    metadata: { section: "email", emailEnabled: data.emailEnabled, smtpHost: data.smtpHost, smtpPort: data.smtpPort },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.adminEmail);
  return { success: true };
}

export async function clearSmtpPasswordAction() {
  const session = await requirePermission("billing:admin");
  await db.systemConfig.upsert({
    where: { id: "system" },
    create: {
      id: "system",
      emailProvider: "HOSTINGER_SMTP",
      emailEnabled: false,
      smtpHost: "smtp.hostinger.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpPasswordEncrypted: null,
      smtpPasswordLast4: null,
    },
    update: {
      emailEnabled: false,
      smtpPasswordEncrypted: null,
      smtpPasswordLast4: null,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "SystemConfig",
    resourceId: "system",
    metadata: { section: "email", action: "clear_smtp_password" },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.adminEmail);
  return { success: true };
}

export async function sendTestEmailAction(recipient: string) {
  const session = await requirePermission("billing:admin");
  const parsedRecipient = z.string().trim().email().parse(recipient);
  const template = testEmail({ appUrl: getAppUrl(), lang: "en" });
  const result = await sendTransactionalEmail({
    to: parsedRecipient,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  await db.systemConfig.upsert({
    where: { id: "system" },
    create: {
      id: "system",
      emailProvider: "HOSTINGER_SMTP",
      emailEnabled: false,
      smtpHost: "smtp.hostinger.com",
      smtpPort: 465,
      smtpSecure: true,
      emailTestRecipient: parsedRecipient,
      emailLastTestAt: new Date(),
      emailLastTestStatus: result.ok ? "success" : "failed",
      emailLastTestMessage: result.message,
    },
    update: {
      emailTestRecipient: parsedRecipient,
      emailLastTestAt: new Date(),
      emailLastTestStatus: result.ok ? "success" : "failed",
      emailLastTestMessage: result.message,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "SystemConfig",
    resourceId: "system",
    metadata: { section: "email", action: "send_test_email", ok: result.ok },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.adminEmail);
  return result;
}
