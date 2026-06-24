import "server-only";

import type { ZatcaEnvironment } from "@repo/zatca";

/**
 * ZATCA target-environment resolver (R5). The engine (`@repo/zatca`) is already env-driven —
 * `createZatcaClient`/`generateCsr` take a `ZatcaEnvironment` and select the gateway base URL +
 * CSR template. The apps/web caller layer used to hardcode `"SANDBOX"`; this module is the single
 * source that decides which environment NEW onboardings + lookups target.
 *
 * ── The one safety rule ──────────────────────────────────────────────────────
 * ZATCA clearance is irreversible and EGS rows hold real CSIDs. The resolver is **fail-safe**:
 * production is opt-in by an EXACT `ZATCA_ENVIRONMENT=PRODUCTION` (or `SIMULATION`) match. Anything
 * else — unset, empty, whitespace, a casing typo, an unknown value — resolves to **SANDBOX**, never
 * production. There is no path by which a missing/garbled env var routes real documents to ZATCA.
 *
 * NOTE: an EXISTING EGS keeps clearing against the environment it was ONBOARDED under
 * (`egs.environment`), regardless of this resolver — see lib/zatca-clearance.ts + lib/zatca-issuance.ts.
 * The resolver decides the target for *new* onboardings + the lookups paired with them.
 */
export function resolveZatcaEnvironment(): ZatcaEnvironment {
  const raw = process.env.ZATCA_ENVIRONMENT?.trim().toUpperCase();
  if (raw === "PRODUCTION") return "PRODUCTION";
  if (raw === "SIMULATION") return "SIMULATION";
  return "SANDBOX";
}

/** Lowercase form for `generateCsr({ environment })` (the engine's CSR side takes lowercase). */
export function resolveZatcaCsrEnvironment(): "sandbox" | "simulation" | "production" {
  return resolveZatcaEnvironment().toLowerCase() as "sandbox" | "simulation" | "production";
}

/** True for any non-SANDBOX target — callers must reject the `123456` sandbox OTP fallback. */
export function zatcaRequiresRealOtp(): boolean {
  return resolveZatcaEnvironment() !== "SANDBOX";
}

/**
 * The CSR Common Name prefix per environment. Sandbox + simulation use ZATCA's published
 * compliance prefixes (`TST-`/`PRE-` with the fixed `886431145` portal identifier — verified
 * accepted by the live sandbox). PRODUCTION's exact CN format is finalized at the real production
 * onboarding (it is not the `TST-`/`886431145` compliance identifier) — see the cutover runbook;
 * production onboarding is an external R5 step, so this returns the documented prod shape but MUST
 * be confirmed against ZATCA's production spec before a real production CSR is filed.
 */
export function zatcaCommonName(vatNumber: string): string {
  switch (resolveZatcaEnvironment()) {
    case "PRODUCTION":
      // TODO(R5-prod): confirm the production CN against ZATCA's production onboarding spec.
      return `${vatNumber}`;
    case "SIMULATION":
      return `PRE-886431145-${vatNumber}`;
    default:
      return `TST-886431145-${vatNumber}`;
  }
}

/** The OTP to send: a caller-supplied OTP, or the sandbox `123456` fallback ONLY in SANDBOX. */
export function resolveZatcaOtp(suppliedOtp: string | undefined): string {
  const otp = suppliedOtp?.trim();
  if (otp) return otp;
  if (zatcaRequiresRealOtp()) {
    throw new Error(
      "A ZATCA OTP is required to onboard against a non-sandbox environment. The sandbox default is not accepted in SIMULATION/PRODUCTION.",
    );
  }
  return "123456";
}
