import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// SEC-003 revocation on the PORTAL surface (re-validation gap, 2026-07-01).
//
// resolvePortalIdentity() authorized a portal end-user (role USER) off the stale
// JWT: it selected only {id,email,organizationId} and never checked isActive /
// tokenVersion. So a DEACTIVATED or token-REVOKED tenant kept portal access
// (summary read + create-maintenance-request write) until the ≤7-day JWT expired,
// while the dashboard — which funnels through getSessionOrThrow — bounced them at
// once. The fix mirrors getSessionOrThrow: reject !isActive or tokenVersion drift.
//
// Wired like sec-audience-pagination.test.ts: a stub db + the REAL helper.
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
// resolvePortalIdentity hashes the email for the customer lookup; the seeded
// customer matches on the plaintext `email` OR-branch, so candidates can be empty.
vi.mock("../lib/pii-crypto", () => ({ searchHashCandidates: () => [] as string[] }));

import { resolvePortalIdentity } from "../lib/server/portal-access";

function portalUser(over: Partial<Row> = {}): Row {
  return { id: "u_tenant", role: "USER", organizationId: ORG, email: "tenant@t.test", name: "T", isActive: true, tokenVersion: 0, ...over };
}
function portalSession(over: Partial<MockUser> = {}): MockUser {
  return { id: "u_tenant", email: "tenant@t.test", name: "T", role: "USER", organizationId: ORG, tokenVersion: 0, isActive: true, ...over };
}
function freshSeed(): Record<string, Row[]> {
  return {
    user: [portalUser()],
    customer: [{ id: "c_1", organizationId: ORG, email: "tenant@t.test", name: "Tenant One" }],
  };
}

beforeEach(() => {
  seed = freshSeed();
  dbHolder.stub = makeStubDb(seed) as StubDb;
  setSession(portalSession());
});

describe("SEC-003 (portal) — resolvePortalIdentity honours revocation", () => {
  it("resolves for an active portal user with a matching customer (positive control)", async () => {
    const id = await resolvePortalIdentity();
    expect(id.user.id).toBe("u_tenant");
    expect(id.customer.id).toBe("c_1");
  });

  it("rejects a DEACTIVATED portal user (isActive=false in the DB)", async () => {
    seed.user![0]!.isActive = false;
    await expect(resolvePortalIdentity()).rejects.toThrow(/unauthorized/i);
  });

  it("rejects a token-REVOKED portal user (DB tokenVersion > the JWT's)", async () => {
    // deactivate / password reset / "sign out everywhere" all bump tokenVersion;
    // the session still carries the old version 0.
    seed.user![0]!.tokenVersion = 1;
    await expect(resolvePortalIdentity()).rejects.toThrow(/unauthorized/i);
  });

  it("still forbids a non-USER role (unchanged)", async () => {
    setSession(portalSession({ role: "ADMIN" }));
    await expect(resolvePortalIdentity()).rejects.toThrow(/forbidden/i);
  });
});
