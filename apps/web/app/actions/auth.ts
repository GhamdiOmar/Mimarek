"use server";

import { signIn } from "../../auth";
import { AuthError } from "next-auth";
import { db } from "@repo/db";
import bcrypt from "bcryptjs";
import { validatePassword } from "../../lib/password-policy";
import { logAuditEvent } from "../../lib/audit";

const ALLOWED_LANDING_PAGES = [
  "/dashboard", "/dashboard/projects", "/dashboard/units",
  "/dashboard/crm", "/dashboard/contracts",
  "/dashboard/leases", "/dashboard/finance", "/dashboard/maintenance",
  "/dashboard/reports", "/dashboard/settings",
];

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Look up user's preferred landing page
  let redirectTo = "/dashboard";
  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { preferences: true },
    });
    const prefs = user?.preferences as any;
    if (prefs?.landingPage && ALLOWED_LANDING_PAGES.includes(prefs.landingPage)) {
      redirectTo = prefs.landingPage;
    }
  } catch {}

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      // The error message might be wrapped by NextAuth
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

    // For non-AuthErrors that might bubble up (like redirects in Next.js which are actually errors)
    if (error.message?.includes("NEXT_REDIRECT")) {
        throw error;
    }

    console.error("Login action error:", error);
    return { error: "UNKNOWN_ERROR" };
  }
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

  // Hash password before transaction (bcrypt is CPU-intensive, keep outside tx)
  const hashedPassword = await bcrypt.hash(data.password, 12);
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
