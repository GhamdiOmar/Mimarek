import "server-only";

import { db } from "@repo/db";
import { randomBytes, createHash } from "crypto";
import { getAppUrl } from "./app-url";

/**
 * Email verification token helpers (OWASP: hash-at-rest, single-use, 24h expiry).
 *
 * Security model:
 *   • The RAW token (`crypto.randomBytes(32).toString("base64url")`) is sent ONLY
 *     in the emailed link. We store ONLY its SHA-256 hash (`tokenHash`); the raw
 *     value never touches the database, so a DB read cannot forge a valid link.
 *   • Single-use: activation flips `usedAt` atomically via updateMany(usedAt: null).
 *   • The emailed link is a GET that renders a confirm page; activation happens on
 *     POST (consumeEmailVerificationToken) so email-scanner / link-prefetch can't
 *     silently consume the token.
 *
 * NOTE: this is a plain module (NOT "use server") so it can export non-async
 * helpers/constants. Server actions live in app/actions/auth.ts.
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** SHA-256 hex digest of the raw token — what we persist + look up by. */
export function sha256Hex(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Build the absolute verify link, using the same base-URL source as the reset flow. */
export function verifyEmailUrl(rawToken: string): string {
  return `${getAppUrl()}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Issue a fresh verification token for a user.
 * Deletes the user's prior UNUSED tokens (one live link at a time), inserts a new
 * row storing only the hash, and returns the RAW token (to be emailed — never stored).
 */
export async function issueEmailVerificationToken(userId: string, email: string): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.$transaction(async (tx: any) => {
    // Invalidate any previous still-pending links for this user.
    await tx.emailVerificationToken.deleteMany({
      where: { userId, usedAt: null },
    });
    await tx.emailVerificationToken.create({
      data: { tokenHash, userId, email, expiresAt },
    });
  });

  return rawToken;
}

export type ConsumeResult = {
  ok: boolean;
  reason?: "invalid" | "expired" | "used";
  // Returned on success so the caller can write an EMAIL_VERIFIED audit event
  // (captured from the user.update return — no extra query).
  userId?: string;
  userEmail?: string;
  userRole?: string;
};

/**
 * Consume a verification token and activate the user — atomic + single-use.
 *
 * Lookup is by hash, so the work is already constant relative to the raw token
 * (no separate timing-safe compare needed). The atomic updateMany(usedAt: null,
 * expiresAt > now) ensures exactly one caller can win the race; if count === 1 we
 * set the user's emailVerified in the SAME transaction. Any other outcome → a
 * generic failure (we deliberately distinguish expired/used only for friendlier
 * copy, never leaking whether the email exists).
 */
export async function consumeEmailVerificationToken(rawToken: string): Promise<ConsumeResult> {
  if (!rawToken) return { ok: false, reason: "invalid" };

  const tokenHash = sha256Hex(rawToken);
  const now = new Date();

  try {
    return await db.$transaction(async (tx: any): Promise<ConsumeResult> => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });

      if (claimed.count === 1) {
        const token = await tx.emailVerificationToken.findUnique({
          where: { tokenHash },
          select: { userId: true },
        });
        if (token) {
          const updated = await tx.user.update({
            where: { id: token.userId },
            data: { emailVerified: now },
            select: { id: true, email: true, role: true },
          });
          return {
            ok: true,
            userId: updated.id,
            userEmail: updated.email,
            userRole: updated.role,
          };
        }
        return { ok: true };
      }

      // Did not claim — figure out why for friendlier (but non-enumerating) copy.
      const existing = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: { usedAt: true, expiresAt: true },
      });
      if (!existing) return { ok: false, reason: "invalid" };
      if (existing.usedAt) return { ok: false, reason: "used" };
      if (existing.expiresAt <= now) return { ok: false, reason: "expired" };
      return { ok: false, reason: "invalid" };
    });
  } catch (error) {
    console.error("[email-verification] consume failed:", error);
    return { ok: false, reason: "invalid" };
  }
}
