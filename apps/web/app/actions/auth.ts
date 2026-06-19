"use server";

import { signIn } from "../../auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { db, Prisma, type User } from "@repo/db";
import { hash as bcryptHash } from "@node-rs/bcrypt";
import { validatePassword } from "../../lib/password-policy";
import { logAuditEvent } from "../../lib/audit";
import { checkRateLimit } from "../../lib/rate-limit";
import { verifyTurnstile } from "../../lib/turnstile";
import { sendTransactionalEmail } from "../../lib/email";
import { verificationEmail } from "../../lib/email-templates";
import {
  issueEmailVerificationToken,
  consumeEmailVerificationToken,
  verifyEmailUrl,
} from "../../lib/email-verification";

const ALLOWED_LANDING_PAGES = [
  "/dashboard", "/dashboard/units",
  "/dashboard/crm", "/dashboard/contracts",
  "/dashboard/leases", "/dashboard/finance", "/dashboard/maintenance",
  "/dashboard/settings",
];

// eslint-disable-next-line mimaric/require-action-guard -- public pre-auth entry point (login); no session exists yet, credentials are the auth.
export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const mode = (formData.get("mode") as string) === "tenant" ? "tenant" : "management";

  // ── Step 1: verify credentials first ──────────────────────────────────────
  // IMPORTANT (QA-SEC-05): we MUST NOT query the DB for the user's role before
  // password verification completes.  Returning role-specific error codes
  // (USE_MANAGEMENT_MODE / USE_TENANT_MODE) before auth reveals whether an
  // email exists and which account type it belongs to — a classic enumeration
  // vector.  Credential verification happens inside signIn(); only after it
  // succeeds do we check the mode, so an attacker learns nothing extra.
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const message =
        (error.cause?.err instanceof Error ? error.cause.err.message : undefined) ||
        error.message;

      if (message === "INVALID_CREDENTIALS") {
        return { error: "INVALID_CREDENTIALS" };
      }
      if (message === "EMAIL_NOT_VERIFIED") {
        return { error: "EMAIL_NOT_VERIFIED" };
      }
      if (message === "ORG_EXPIRED") {
        return { error: "ORG_EXPIRED" };
      }
      if (message === "DATABASE_ERROR") {
        return { error: "DATABASE_ERROR" };
      }
      if (message?.startsWith("RATE_LIMITED")) {
        return { error: message };
      }

      switch (error.type) {
        case "CredentialsSignin":
          return { error: "INVALID_CREDENTIALS" };
        default:
          return { error: "AUTH_ERROR" };
      }
    }

    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }

    console.error("Login action error:", error);
    return { error: "UNKNOWN_ERROR" };
  }

  // ── Step 2: credentials verified — now check mode + resolve redirect ───────
  // At this point the user is authenticated; mode-mismatch is a UX redirect
  // hint, not a security gate.  Returning USE_MANAGEMENT_MODE / USE_TENANT_MODE
  // here is safe because the password check already passed.
  const normalizedEmail = email.toLowerCase().trim();
  let redirectTo = "/dashboard";
  try {
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { preferences: true, role: true },
    });
    if (mode === "tenant") {
      if (user && user.role !== "USER") return { error: "USE_MANAGEMENT_MODE" };
      redirectTo = "/portal";
    } else if (user?.role === "USER") {
      return { error: "USE_TENANT_MODE" };
    }
    const prefs =
      user?.preferences && typeof user.preferences === "object" && !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : undefined;
    const landingPage = typeof prefs?.landingPage === "string" ? prefs.landingPage : undefined;
    if (mode === "management" && landingPage && ALLOWED_LANDING_PAGES.includes(landingPage)) {
      redirectTo = landingPage;
    }
  } catch {}

  return { success: true, redirectTo };
}

// eslint-disable-next-line mimaric/require-action-guard -- public pre-auth signup; creates the first account/org, so no prior session can gate it.
export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  accountType?: "individual" | "company";
  captchaToken?: string;
}) {
  const accountType = data.accountType ?? "individual";

  // Read the client IP once — used both by Turnstile scoring and rate-limiting.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();

  // CAPTCHA FIRST — verify before any password validation / bcrypt so a bot that
  // fails the challenge burns zero CPU. Graceful-degrades: when TURNSTILE_SECRET_KEY
  // is unset (dev/local), verifyTurnstile returns true and this gate is a no-op.
  if (!(await verifyTurnstile(data.captchaToken, ip))) {
    return { error: "CAPTCHA_FAILED" };
  }

  // Validate password
  const validation = validatePassword(data.password, { name: data.name, email: data.email });
  if (!validation.valid) {
    return { error: "WEAK_PASSWORD", details: validation.errors };
  }

  // Rate limiting — OWASP anti-automation on registration
  // Per-IP: 5 attempts / hour (carrier-grade NAT safe; skip if header absent)
  // Per-normalized-email: 3 attempts / hour (defeats +aliasing)
  // Normalize email for rate-limit key only: lowercase + strip +suffix from local part
  const localPart = data.email.split("@")[0] ?? "";
  const domain = data.email.split("@")[1] ?? "";
  const normalizedLocal = localPart.replace(/\+.*$/, "").toLowerCase();
  const normalizedEmailKey = `${normalizedLocal}@${domain.toLowerCase()}`;

  if (ip) {
    const ipRl = await checkRateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000);
    if (!ipRl.allowed) {
      return { error: "RATE_LIMITED" };
    }
  }
  const emailRl = await checkRateLimit(`register:email:${normalizedEmailKey}`, 3, 60 * 60 * 1000);
  if (!emailRl.allowed) {
    return { error: "RATE_LIMITED" };
  }

  // Hash password before transaction (bcrypt is CPU-intensive, keep outside tx)
  const hashedPassword = await bcryptHash(data.password, 12);
  const normalizedEmail = data.email.toLowerCase().trim();
  const orgName = accountType === "company" ? data.name : `${data.name}'s Workspace`;

  let user: User;
  try {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          entityType: accountType === "company" ? "COMPANY" : "ESTABLISHMENT",
          // E1: org starts pending; flips to ACTIVE when the registering admin
          // confirms their email (consumeEmailVerificationToken). The
          // expire-unverified-orgs cron marks it EXPIRED after 14 days unverified.
          appStatus: "PENDING_VERIFICATION",
        },
      });

      const newUser = await tx.user.create({
        data: {
          name: data.name,
          email: normalizedEmail,
          password: hashedPassword,
          role: "ADMIN",
          organizationId: org.id,
          accountType,
          onboardingCompleted: false,
          invitedVia: "registration",
          // Email-verification-before-activation: new accounts start unverified.
          // Login is denied (EMAIL_NOT_VERIFIED) until the user confirms via email.
          emailVerified: null,
        },
      });

      return { org, user: newUser };
    });

    user = result.user;
  } catch (error) {
    // Prisma unique constraint violation on User.email.
    // `meta.target` is a string[] of conflicting columns on Postgres (via
    // @prisma/adapter-pg); we also accept a bare string to mirror the original
    // `.includes("email")` semantics exactly across Prisma versions.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target;
      if (
        (Array.isArray(target) && target.includes("email")) ||
        (typeof target === "string" && target.includes("email"))
      ) {
        return { error: "EMAIL_EXISTS" };
      }
    }
    throw error;
  }

  logAuditEvent({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    action: "REGISTER",
    resource: "Auth",
    organizationId: user.organizationId,
  });

  // Email-verification-before-activation: do NOT auto-sign-in. Issue a single-use
  // token and email a confirm link; the user activates by confirming, then logs in.
  try {
    const rawToken = await issueEmailVerificationToken(user.id, user.email);
    const template = verificationEmail({ name: user.name, verifyUrl: verifyEmailUrl(rawToken) });
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
      action: "EMAIL_VERIFICATION_REQUEST",
      resource: "Auth",
      metadata: { emailSent: emailResult.ok, emailCode: emailResult.code },
      organizationId: user.organizationId,
    });
  } catch (error) {
    // Never fail registration on email-send issues — the user can resend.
    console.error("[register] verification email dispatch failed:", error);
  }

  return { ok: true, success: true, needsVerification: true, email: user.email };
}

/**
 * Confirm an email-verification token (called from the POST button on the
 * /auth/verify-email confirm page). Activation happens here — never on the GET —
 * so link-prefetch / email scanners cannot consume the single-use token.
 */
// eslint-disable-next-line mimaric/require-action-guard -- public pre-auth flow: activates an account from an emailed single-use token; authorization IS the token (hash-matched, single-use, 24h TTL). No session exists yet.
export async function confirmEmailVerificationAction(token: string) {
  const result = await consumeEmailVerificationToken(token);
  if (result.ok) {
    if (result.userId && result.userEmail && result.userRole) {
      logAuditEvent({
        userId: result.userId,
        userEmail: result.userEmail,
        userRole: result.userRole,
        action: "EMAIL_VERIFIED",
        resource: "User",
        resourceId: result.userId,
        organizationId: null,
      });
    }
    return { success: true };
  }
  return { error: result.reason ?? "invalid" };
}

/**
 * Resend a verification email. Anti-enumeration: the response is IDENTICAL for
 * not-found / already-verified / sent / rate-limited so an attacker learns
 * nothing about whether an email exists or its verification state.
 */
// eslint-disable-next-line mimaric/require-action-guard -- public pre-auth flow: resends a verification email before the account is active (no session). Rate-limited per email+IP and anti-enumeration (identical generic response in all cases).
export async function resendVerificationAction(email: string) {
  const normalizedEmail = (email ?? "").toLowerCase().trim();

  // Rate limit per email + per IP (mirrors registration / password-reset).
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) {
    const ipRl = await checkRateLimit(`resend-verification:ip:${ip}`, 5, 60 * 60 * 1000, { failClosed: true });
    if (!ipRl.allowed) {
      return { success: true };
    }
  }
  if (normalizedEmail) {
    const emailRl = await checkRateLimit(`resend-verification:email:${normalizedEmail}`, 3, 60 * 60 * 1000, { failClosed: true });
    if (!emailRl.allowed) {
      return { success: true };
    }
  }

  try {
    const user = normalizedEmail
      ? await db.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, email: true, name: true, emailVerified: true },
        })
      : null;

    // Only send when the account exists AND is still unverified. In every other
    // case we return the same generic success below.
    if (user && !user.emailVerified) {
      const rawToken = await issueEmailVerificationToken(user.id, user.email);
      const template = verificationEmail({ name: user.name, verifyUrl: verifyEmailUrl(rawToken) });
      await sendTransactionalEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    }
  } catch (error) {
    console.error("[resend-verification] failed:", error);
    // Still return generic success — do not leak the failure.
  }

  return { success: true };
}
