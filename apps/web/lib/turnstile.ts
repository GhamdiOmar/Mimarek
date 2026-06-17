import "server-only";

/**
 * Cloudflare Turnstile server-side verification (E1 registration hardening).
 *
 * GRACEFUL-DEGRADE design — Mimaric is not yet deployed and keys may be unset
 * locally:
 *   • No TURNSTILE_SECRET_KEY  → Turnstile is DISABLED (returns true). Local /
 *     undeployed registration keeps working without any captcha.
 *   • Secret set, no token     → fail CLOSED (a configured deployment must not be
 *     bypassable by simply omitting the token).
 *   • Network / parse error    → fail CLOSED (don't let an outage open the gate).
 *
 * Enforcement is therefore opt-in: it only kicks in once a secret is configured.
 *
 * @param token     The cf-turnstile-response token from the client widget.
 * @param remoteip  Optional client IP (x-forwarded-for) for stricter scoring.
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // NOT configured → Turnstile disabled (dev/local).
  if (!token) return false; // configured but no token → fail closed

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteip) body.append("remoteip", remoteip);

  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const j = await r.json();
    return j.success === true;
  } catch (e) {
    console.error("[turnstile] verify failed:", e);
    return false; // fail closed on network error
  }
}
