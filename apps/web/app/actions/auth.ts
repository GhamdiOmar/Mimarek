"use server";

import { signIn } from "../../auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { db } from "@repo/db";
import { hash as bcryptHash } from "@node-rs/bcrypt";
import { validatePassword } from "../../lib/password-policy";
import { logAuditEvent } from "../../lib/audit";
import { checkRateLimit } from "../../lib/rate-limit";

const ALLOWED_LANDING_PAGES = [
  "/dashboard", "/dashboard/units",
  "/dashboard/crm", "/dashboard/contracts",
  "/dashboard/leases", "/dashboard/finance", "/dashboard/maintenance",
  "/dashboard/settings",
];

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
  } catch (error: any) {
    if (error instanceof AuthError) {
      const message = error.cause?.err?.message || error.message;

      if (message === "INVALID_CREDENTIALS") {
        return { error: "INVALID_CREDENTIALS" };
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

    if (error.message?.includes("NEXT_REDIRECT")) {
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
    const prefs = user?.preferences as any;
    if (mode === "management" && prefs?.landingPage && ALLOWED_LANDING_PAGES.includes(prefs.landingPage)) {
      redirectTo = prefs.landingPage;
    }
  } catch {}

  return { success: true, redirectTo };
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  accountType?: "individual" | "company";
}) {
  const accountType = data.accountType ?? "individual";

  // Validate password
  const validation = validatePassword(data.password, { name: data.name, email: data.email });
  if (!validation.valid) {
    return { error: "WEAK_PASSWORD", details: validation.errors };
  }

  // Rate limiting — OWASP anti-automation on registration
  // Per-IP: 5 attempts / hour (carrier-grade NAT safe; skip if header absent)
  // Per-normalized-email: 3 attempts / hour (defeats +aliasing)
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
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

  let user: any;
  try {
    const result = await db.$transaction(async (tx: any) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          entityType: accountType === "company" ? "COMPANY" : "ESTABLISHMENT",
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
        },
      });

      return { org, user: newUser };
    });

    user = result.user;
  } catch (error: any) {
    // Prisma unique constraint violation on User.email
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return { error: "EMAIL_EXISTS" };
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

  // Auto-sign-in the newly created user
  try {
    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
  } catch (error: any) {
    // signIn may throw a redirect error in Next.js — that's fine
    if (!error.message?.includes("NEXT_REDIRECT")) {
      console.error("Auto-sign-in after registration failed:", error);
    }
  }

  return { success: true, redirect: "/dashboard/onboarding" };
}
