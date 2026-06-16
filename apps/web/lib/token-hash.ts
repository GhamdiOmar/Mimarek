import { createHash } from "crypto";

/**
 * Shared token-hash helper (OWASP: hash-at-rest for opaque tokens).
 *
 * SHA-256 hex digest of a raw token — what we persist + look up by. The raw
 * token lives only in the emailed link; only this hash touches the database,
 * so a DB read cannot forge a valid link.
 *
 * NOTE: plain module (NOT "use server"), so a non-async export is fine. Used by
 * both the password-reset flow (app/actions/password.ts) and the email
 * verification flow (lib/email-verification.ts).
 */
export function sha256Hex(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
