import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@repo/db";
import { compare as bcryptCompare } from "@node-rs/bcrypt";
import { authConfig } from "./auth.config";
import { logAuditEvent } from "./lib/audit";
import { checkRateLimit, peekRateLimit } from "./lib/rate-limit";

// Login rate-limit tier definitions — preserved from the original in-memory limiter.
const LOGIN_TIERS = [
  { limit: 5,  windowMs: 30  * 1000        }, // Tier 1: 5 fails → 30 s cooldown
  { limit: 10, windowMs: 5   * 60 * 1000   }, // Tier 2: 10 fails → 5 min cooldown
  { limit: 20, windowMs: 15  * 60 * 1000   }, // Tier 3: 20 fails → 15 min cooldown
] as const;

/**
 * Pre-flight gate — reads current counters WITHOUT incrementing.
 * Returns blocked=true if any tier has already been exhausted.
 * Fails open on DB error.
 */
async function gateLoginRateLimit(
  email: string,
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const results = await Promise.all(
    LOGIN_TIERS.map((tier, i) =>
      peekRateLimit(`login:t${i + 1}:${email}`, tier.limit),
    ),
  );

  let maxRetryAfterMs = 0;
  let blocked = false;
  for (const result of results) {
    if (!result.allowed && result.retryAfterMs !== undefined) {
      blocked = true;
      if (result.retryAfterMs > maxRetryAfterMs) {
        maxRetryAfterMs = result.retryAfterMs;
      }
    }
  }

  return {
    blocked,
    retryAfterSeconds: blocked ? Math.ceil(maxRetryAfterMs / 1000) : 0,
  };
}

/**
 * Increment all three tier counters after a failed credential check.
 * Counters expire naturally after their window — no active reset on success.
 * Fails open on DB error.
 */
async function recordLoginFailure(email: string): Promise<void> {
  await Promise.all(
    LOGIN_TIERS.map((tier, i) =>
      checkRateLimit(`login:t${i + 1}:${email}`, tier.limit, tier.windowMs),
    ),
  );
}

/**
 * Full auth config — extends edge-safe authConfig with Node.js-only features:
 * PrismaAdapter, bcrypt password verification, Credentials provider.
 */
const result = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  // 7-day absolute max; token refreshed silently every 24 h of activity.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();

        // Pre-flight gate — read-only check; does NOT increment counters.
        // Fails open on DB error (a Postgres hiccup must never lock users out).
        const rateCheck = await gateLoginRateLimit(email);
        if (rateCheck.blocked) {
          throw new Error(`RATE_LIMITED:${rateCheck.retryAfterSeconds}`);
        }

        try {
          const user = await db.user.findUnique({
            where: { email },
            select: {
              id: true, email: true, name: true, password: true,
              role: true, organizationId: true,
              onboardingCompleted: true, accountType: true,
            },
          });

          if (!user) {
            await recordLoginFailure(email);
            throw new Error("INVALID_CREDENTIALS");
          }

          if (!user.password) {
            await recordLoginFailure(email);
            throw new Error("INVALID_CREDENTIALS");
          }

          const isValid = await bcryptCompare(credentials.password as string, user.password);
          if (!isValid) {
            await recordLoginFailure(email);
            throw new Error("INVALID_CREDENTIALS");
          }

          // Success — counters expire naturally; no active clear needed.

          // Log successful login
          logAuditEvent({
            userId: user.id,
            userEmail: user.email,
            userRole: user.role,
            action: "LOGIN",
            resource: "Auth",
            organizationId: user.organizationId,
          });

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            onboardingCompleted: (user as any).onboardingCompleted ?? true,
            accountType: (user as any).accountType ?? null,
          };
        } catch (error: any) {
          if (error.message === "INVALID_CREDENTIALS" || error.message.startsWith("RATE_LIMITED")) {
            throw error;
          }
          console.error("Auth error:", error);
          throw new Error("DATABASE_ERROR");
        }
      },
    }),
  ],
});

export const handlers = result.handlers;
export const auth: any = result.auth;
export const signIn: any = result.signIn;
export const signOut: any = result.signOut;
