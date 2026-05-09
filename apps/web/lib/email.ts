import { db } from "@repo/db";
import nodemailer from "nodemailer";
import { decrypt } from "./encryption";

export type EmailSettings = {
  emailProvider: string;
  emailEnabled: boolean;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string | null;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPasswordLast4: string | null;
  emailTestRecipient: string | null;
  emailLastTestAt: Date | null;
  emailLastTestStatus: string | null;
  emailLastTestMessage: string | null;
  hasSmtpPassword: boolean;
};

type SecretEmailSettings = EmailSettings & { smtpPassword: string | null };

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
};

export type EmailResult = {
  ok: boolean;
  code?: "EMAIL_DISABLED" | "EMAIL_INCOMPLETE" | "EMAIL_SECRET_UNAVAILABLE" | "SMTP_ERROR";
  message: string;
};

const DEFAULTS = {
  provider: "HOSTINGER_SMTP",
  host: "smtp.hostinger.com",
  port: 465,
  secure: true,
  fromName: "Mimaric",
};

function friendlySmtpError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/auth|login|credential|password|535|5\.7\.8/i.test(message)) {
    return "SMTP authentication failed. Check the mailbox username and password.";
  }
  if (/timeout|etimedout|connection/i.test(message)) {
    return "Mimaric could not reach the SMTP server. Check host, port, and encryption mode.";
  }
  return "Mimaric could not send email with the current SMTP settings.";
}

function toPublicSettings(config: Awaited<ReturnType<typeof db.systemConfig.findUnique>>): EmailSettings {
  return {
    emailProvider: config?.emailProvider ?? DEFAULTS.provider,
    emailEnabled: config?.emailEnabled ?? false,
    emailFromName: config?.emailFromName ?? DEFAULTS.fromName,
    emailFromAddress: config?.emailFromAddress ?? "",
    emailReplyTo: config?.emailReplyTo ?? null,
    smtpHost: config?.smtpHost ?? DEFAULTS.host,
    smtpPort: config?.smtpPort ?? DEFAULTS.port,
    smtpSecure: config?.smtpSecure ?? DEFAULTS.secure,
    smtpUsername: config?.smtpUsername ?? "",
    smtpPasswordLast4: config?.smtpPasswordLast4 ?? null,
    emailTestRecipient: config?.emailTestRecipient ?? null,
    emailLastTestAt: config?.emailLastTestAt ?? null,
    emailLastTestStatus: config?.emailLastTestStatus ?? null,
    emailLastTestMessage: config?.emailLastTestMessage ?? null,
    hasSmtpPassword: Boolean(config?.smtpPasswordEncrypted),
  };
}

export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    const config = await db.systemConfig.findUnique({ where: { id: "system" } });
    return toPublicSettings(config);
  } catch {
    return toPublicSettings(null);
  }
}

async function getSecretEmailSettings(): Promise<SecretEmailSettings> {
  try {
    const config = await db.systemConfig.findUnique({ where: { id: "system" } });
    const settings = toPublicSettings(config);

    if (!config?.smtpPasswordEncrypted) {
      return { ...settings, smtpPassword: null };
    }

    try {
      return { ...settings, smtpPassword: decrypt(config.smtpPasswordEncrypted) };
    } catch {
      return { ...settings, smtpPassword: null };
    }
  } catch {
    const settings = toPublicSettings(null);
    return { ...settings, smtpPassword: null };
  }
}

function isComplete(settings: SecretEmailSettings): boolean {
  return Boolean(
    settings.emailEnabled &&
      settings.smtpHost &&
      settings.smtpPort &&
      settings.smtpUsername &&
      settings.smtpPassword &&
      settings.emailFromAddress,
  );
}

function createTransport(settings: SecretEmailSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: {
      user: settings.smtpUsername,
      pass: settings.smtpPassword ?? "",
    },
  });
}

function formatFrom(settings: SecretEmailSettings): string {
  const name = settings.emailFromName.trim() || DEFAULTS.fromName;
  return `"${name.replace(/"/g, "'")}" <${settings.emailFromAddress}>`;
}

export async function verifySmtpConnection(): Promise<EmailResult> {
  const settings = await getSecretEmailSettings();
  if (!settings.emailEnabled) {
    return { ok: false, code: "EMAIL_DISABLED", message: "Email sending is disabled." };
  }
  if (!isComplete(settings)) {
    return { ok: false, code: "EMAIL_INCOMPLETE", message: "Email settings are incomplete." };
  }

  try {
    await createTransport(settings).verify();
    return { ok: true, message: "SMTP connection verified." };
  } catch (error) {
    return { ok: false, code: "SMTP_ERROR", message: friendlySmtpError(error) };
  }
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<EmailResult> {
  const settings = await getSecretEmailSettings();
  if (!settings.emailEnabled) {
    return { ok: false, code: "EMAIL_DISABLED", message: "Email sending is disabled." };
  }
  if (!isComplete(settings)) {
    return { ok: false, code: "EMAIL_INCOMPLETE", message: "Email settings are incomplete." };
  }

  try {
    await createTransport(settings).sendMail({
      from: formatFrom(settings),
      to: input.to,
      replyTo: input.replyTo ?? settings.emailReplyTo ?? undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true, message: "Email sent." };
  } catch (error) {
    return { ok: false, code: "SMTP_ERROR", message: friendlySmtpError(error) };
  }
}
