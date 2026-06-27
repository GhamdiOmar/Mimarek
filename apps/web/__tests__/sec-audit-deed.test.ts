import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// SEC-015 — durable (fail-closed) audit for security-critical MUTATIONS.
// SEC-016 — deed-proof URL hardening (https-only).
//
// (a) logAuditEventAwait rejects when db.auditLog.create throws (await → throws);
//     logAuditEvent does NOT throw for the same failure (fire-and-forget swallows).
// (b) submitDeedTransferProof rejects a non-https deedDocUrl.
//
// Wired like hardening-wave-a.test.ts: a stub db + a session we set + the REAL
// guards from lib/auth-helpers. PII crypto is stubbed so writes don't need keys.
// ─────────────────────────────────────────────────────────────────────────────

const ORG = "org_a";

let seed: Record<string, Row[]>;

const { dbHolder, dbProxy } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub holder
  const dbHolder: { stub: any } = { stub: undefined };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub proxy
  const dbProxy = new Proxy({} as any, { get: (_t, model) => dbHolder.stub?.[model] });
  return { dbHolder, dbProxy };
});

vi.mock("@repo/db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return { ...prisma, db: dbProxy };
});
vi.mock("../auth", () => ({ auth, signIn, signOut, handlers: {} }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unstable_cache passthrough
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: any) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => new Map() }));
// PII crypto is exercised by its own suite — stub so deed writes don't need keys.
vi.mock("../lib/pii-crypto", () => ({
  encryptCustomerData: (d: Record<string, unknown>) => d,
  safeDecryptField: (v: string) => v,
}));
vi.mock("../lib/encryption", () => ({ encrypt: (s: string) => `enc:${s}` }));

import { logAuditEvent, logAuditEventAwait } from "../lib/audit";
import { submitDeedTransferProof } from "../app/actions/marketplace";

function user(id: string, over: Partial<Row> = {}): Row {
  return { id, role: "ADMIN", organizationId: ORG, name: "U", email: `${id}@t.test`, isActive: true, tokenVersion: 0, password: "x", ...over };
}
function asSession(id: string, over: Partial<MockUser> = {}): MockUser {
  return { id, email: `${id}@t.test`, name: "U", role: "ADMIN", organizationId: ORG, ...over };
}

function freshSeed(): Record<string, Row[]> {
  return {
    user: [user("u_admin")],
    unitTransferTransaction: [{ id: "tr_1", sellerOrgId: ORG, buyerOrgId: "org_b", status: "PENDING_SETTLEMENT" }],
    marketplaceDeedProof: [],
    auditLog: [],
  };
}

beforeEach(() => {
  seed = freshSeed();
  dbHolder.stub = makeStubDb(seed) as StubDb;
  setSession(asSession("u_admin"));
});

const auditParams = {
  userId: "u_admin",
  userEmail: "u_admin@t.test",
  userRole: "ADMIN",
  action: "DEED_PROOF_VERIFIED" as const,
  resource: "MarketplaceDeedProof",
  resourceId: "x",
  organizationId: null,
};

describe("SEC-015 — audit write contracts (await throws / fire-and-forget swallows)", () => {
  it("logAuditEventAwait REJECTS when db.auditLog.create throws (fail-closed)", async () => {
    dbHolder.stub.auditLog.create = vi.fn().mockRejectedValue(new Error("audit store down"));
    await expect(logAuditEventAwait(auditParams)).rejects.toThrow(/audit store down/);
  });

  it("logAuditEvent does NOT throw for the same failure (fire-and-forget swallows)", async () => {
    dbHolder.stub.auditLog.create = vi.fn().mockRejectedValue(new Error("audit store down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // The synchronous call must not throw…
    expect(() => logAuditEvent(auditParams)).not.toThrow();
    // …and the swallowed rejection must settle to a console.error, not an unhandled
    // throw. The writer awaits headers() first, so the .catch() lands a few
    // microtasks later — poll until it does (or assert it never rethrows).
    await vi.waitFor(() =>
      expect(errSpy).toHaveBeenCalledWith("[Audit] Failed to log event:", expect.any(Error)),
    );
    errSpy.mockRestore();
  });

  it("logAuditEventAwait resolves when the write succeeds (positive control)", async () => {
    await expect(logAuditEventAwait(auditParams)).resolves.toBeUndefined();
    expect(seed.auditLog!.length).toBe(1);
  });
});

describe("SEC-016 — submitDeedTransferProof rejects a non-https deedDocUrl", () => {
  it("rejects an http: deed document URL", async () => {
    await expect(
      submitDeedTransferProof("tr_1", { deedDocUrl: "http://evil.example/deed.pdf" } as never),
    ).rejects.toThrow(/secure https link|https/i);
    // Nothing persisted on rejection.
    expect(seed.marketplaceDeedProof!.length).toBe(0);
  });

  it("rejects a javascript: pseudo-URL", async () => {
    await expect(
      submitDeedTransferProof("tr_1", { deedDocUrl: "javascript:alert(1)" } as never),
    ).rejects.toThrow(/secure https link|https/i);
    expect(seed.marketplaceDeedProof!.length).toBe(0);
  });

  it("accepts an https deed document URL (positive control)", async () => {
    const result = await submitDeedTransferProof("tr_1", {
      deedDocUrl: "https://c5k2lwc5ws.ufs.sh/f/deed-abc",
    } as never);
    expect(result).toBeTruthy();
    expect(seed.marketplaceDeedProof!.length).toBe(1);
    expect(seed.marketplaceDeedProof![0]!.deedDocUrl).toBe("https://c5k2lwc5ws.ufs.sh/f/deed-abc");
  });
});
