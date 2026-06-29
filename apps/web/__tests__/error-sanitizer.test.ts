import { describe, it, expect } from "vitest";
import { sanitizeError } from "../lib/error-sanitizer";

// §6.11.4 — every user-facing error must be friendly + bilingual, never a raw
// stack trace / variable name / dev string. These lock the sanitizer contract,
// including the pricing entitlement-denial mappings (CX / §6.11.4).

describe("sanitizeError — technical leaks collapse to the bilingual generic", () => {
  it("hides Prisma / unique-constraint internals", () => {
    expect(sanitizeError(new Error("Invalid `prisma.user.create()` — Unique constraint failed"), "en")).toMatch(/something went wrong/i);
    expect(sanitizeError(new Error("PrismaClientKnownRequestError: P2002"), "ar")).toMatch(/تعذّر/);
  });
  it("hides undefined / stack-trace leaks", () => {
    expect(sanitizeError(new Error("Cannot read properties of undefined (reading 'x')"), "en")).toMatch(/something went wrong/i);
  });
});

describe("sanitizeError — known classes map to bilingual copy", () => {
  it("forbidden / permission", () => {
    expect(sanitizeError(new Error("Forbidden: missing permission 'crm:write'"), "ar")).toMatch(/صلاحية/);
    expect(sanitizeError(new Error("Forbidden: missing permission 'crm:write'"), "en")).toMatch(/permission/i);
  });
  it("unauthorized", () => {
    expect(sanitizeError(new Error("Unauthorized"), "en")).toMatch(/sign in/i);
  });
});

describe("sanitizeError — pricing entitlement denials → bilingual upgrade/limit copy", () => {
  it("feature-not-in-plan → bilingual upgrade copy", () => {
    expect(sanitizeError(new Error("Feature not included in current plan"), "en")).toMatch(/current plan.*upgrade/i);
    const ar = sanitizeError(new Error("Feature not included in current plan"), "ar");
    expect(ar).toMatch(/خطتك الحالية/);
    expect(ar).toMatch(/ترقية/);
  });
  it("feature-disabled → bilingual upgrade copy", () => {
    expect(sanitizeError(new Error("Feature disabled on current plan"), "ar")).toMatch(/ترقية/);
  });
  it("no-active-subscription → bilingual upgrade copy", () => {
    expect(sanitizeError(new Error("No active subscription"), "en")).toMatch(/current plan/i);
  });
  it("limit-cap → bilingual limit copy", () => {
    expect(sanitizeError(new Error("Limit reached (200/200)"), "en")).toMatch(/limit.*upgrade/i);
    expect(sanitizeError(new Error("Customer limit reached. Please upgrade your plan."), "ar")).toMatch(/الحد الأقصى/);
  });
  it("hides the raw feature-key fallback (no variable name leaks)", () => {
    const en = sanitizeError(new Error("Access denied: customers.max not available on your current plan"), "en");
    expect(en).not.toMatch(/customers\.max/); // the key must not reach the user
    expect(en).toMatch(/upgrade/i);
  });
});

describe("sanitizeError — dev-ish misconfiguration never shows as user copy", () => {
  it("invalid limit configuration → generic", () => {
    expect(sanitizeError(new Error("Invalid limit configuration"), "en")).toMatch(/something went wrong/i);
  });
  it("unknown entitlement type → generic", () => {
    expect(sanitizeError(new Error("Unknown entitlement type: WEIRD"), "en")).toMatch(/something went wrong/i);
  });
});

describe("sanitizeError — clean business messages pass through verbatim", () => {
  it("keeps a short deliberate domain message", () => {
    const msg = "This customer already has an active reservation for this unit.";
    expect(sanitizeError(new Error(msg), "en")).toBe(msg);
  });
});
