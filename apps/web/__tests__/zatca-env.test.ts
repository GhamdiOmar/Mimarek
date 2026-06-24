import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveZatcaEnvironment,
  resolveZatcaCsrEnvironment,
  zatcaRequiresRealOtp,
  resolveZatcaOtp,
  zatcaCommonName,
} from "../lib/zatca-env";

/**
 * The R5 env resolver. The one rule that matters: production is opt-in by an EXACT
 * `ZATCA_ENVIRONMENT=PRODUCTION` match — anything else resolves to SANDBOX, never production.
 * (zatca-env.ts only type-imports @repo/zatca, so it loads fine in the web vitest env.)
 */

const KEY = "ZATCA_ENVIRONMENT";
let original: string | undefined;

beforeEach(() => {
  original = process.env[KEY];
});
afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

function setEnv(v: string | undefined) {
  if (v === undefined) delete process.env[KEY];
  else process.env[KEY] = v;
}

describe("resolveZatcaEnvironment — fail-safe default (the safety rule)", () => {
  it("PRODUCTION / SIMULATION resolve only on an exact (case-insensitive) match", () => {
    setEnv("PRODUCTION");
    expect(resolveZatcaEnvironment()).toBe("PRODUCTION");
    setEnv("production");
    expect(resolveZatcaEnvironment()).toBe("PRODUCTION");
    setEnv("  Simulation  ");
    expect(resolveZatcaEnvironment()).toBe("SIMULATION");
  });

  it("unset / empty / whitespace / typo / unknown ALL resolve to SANDBOX (never PRODUCTION)", () => {
    for (const v of [undefined, "", "   ", "prod", "PROD", "live", "produciton", "0", "true", "sandbox"]) {
      setEnv(v);
      expect(resolveZatcaEnvironment(), `value=${JSON.stringify(v)}`).toBe("SANDBOX");
    }
  });

  it("explicit SANDBOX stays SANDBOX", () => {
    setEnv("SANDBOX");
    expect(resolveZatcaEnvironment()).toBe("SANDBOX");
  });
});

describe("resolveZatcaCsrEnvironment — lowercase for generateCsr", () => {
  it("mirrors the resolved env, lowercased", () => {
    setEnv("PRODUCTION");
    expect(resolveZatcaCsrEnvironment()).toBe("production");
    setEnv("SIMULATION");
    expect(resolveZatcaCsrEnvironment()).toBe("simulation");
    setEnv(undefined);
    expect(resolveZatcaCsrEnvironment()).toBe("sandbox");
  });
});

describe("OTP gating", () => {
  it("requires a real OTP only for non-sandbox", () => {
    setEnv("SANDBOX");
    expect(zatcaRequiresRealOtp()).toBe(false);
    setEnv("PRODUCTION");
    expect(zatcaRequiresRealOtp()).toBe(true);
  });

  it("falls back to the sandbox 123456 ONLY in sandbox, rejects the fallback otherwise", () => {
    setEnv("SANDBOX");
    expect(resolveZatcaOtp(undefined)).toBe("123456");
    expect(resolveZatcaOtp("999111")).toBe("999111");
    setEnv("PRODUCTION");
    expect(() => resolveZatcaOtp(undefined)).toThrow();
    expect(resolveZatcaOtp("654321")).toBe("654321"); // a supplied OTP always wins
  });
});

describe("zatcaCommonName — env-keyed CSR common name", () => {
  it("uses the sandbox TST- / simulation PRE- prefixes", () => {
    const vat = "300000000000003";
    setEnv("SANDBOX");
    expect(zatcaCommonName(vat)).toBe(`TST-886431145-${vat}`);
    setEnv("SIMULATION");
    expect(zatcaCommonName(vat)).toBe(`PRE-886431145-${vat}`);
    setEnv("PRODUCTION");
    // production CN drops the TST/886431145 compliance identifier (finalized at prod onboarding)
    expect(zatcaCommonName(vat)).not.toContain("TST-");
    expect(zatcaCommonName(vat)).not.toContain("886431145");
  });
});
