import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// SEC-006 — authorized document download routes (integration / "simulating user").
//
// Exercises the REAL route handlers end-to-end against a stub DB + a session we
// set, proving the authorization matrix the audit demanded:
//   • dashboard  /api/documents/[id]        → session + documents:read + org-scope
//   • portal     /api/portal/documents/[id] → portal identity + customer/lease scope
//
// The raw UploadThing object URL never leaves the server: success is a 307 to a
// freshly-minted signed URL; everything else is 403 / 404 / login-redirect.
// ─────────────────────────────────────────────────────────────────────────────

const ORG = "org_a";
const OTHER = "org_b";

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
// portal-access resolves the customer by blind-index hash; the hash itself is
// covered by pii-crypto's own suite, so stub it here (no real PII keys needed).
vi.mock("../lib/pii-crypto", () => ({ searchHashCandidates: () => [] }));

// UploadThing signed-URL minting — return a deterministic CDN URL so the happy
// path can assert the redirect target without any network call.
const SIGNED_URL = "https://c5k2lwc5ws.ufs.sh/f/signed-key?x=expires";
vi.mock("uploadthing/server", () => ({
  UTApi: class {
    async generateSignedURL() {
      return { ufsUrl: SIGNED_URL };
    }
  },
}));

import { GET as documentsGet } from "../app/api/documents/[id]/route";
import { GET as portalDocumentsGet } from "../app/api/portal/documents/[id]/route";

function req(path: string): Request {
  return new Request(`http://localhost:3000${path}`);
}
function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}
function userRow(id: string, over: Partial<Row> = {}): Row {
  return { id, role: "ADMIN", organizationId: ORG, name: "U", email: `${id}@t.test`, isActive: true, tokenVersion: 0, ...over };
}
function asSession(id: string, over: Partial<MockUser> = {}): MockUser {
  return { id, email: `${id}@t.test`, name: "U", role: "ADMIN", organizationId: ORG, ...over };
}

function freshSeed(): Record<string, Row[]> {
  return {
    user: [
      userRow("u_admin"),
      userRow("u_tech", { role: "TECHNICIAN" }),
      userRow("u_sys", { role: "SYSTEM_ADMIN", organizationId: null }),
      userRow("u_portal", { role: "USER", email: "tenant@t.test" }),
      userRow("u_portal_other", { role: "USER", email: "other@t.test" }),
    ],
    customer: [
      { id: "cust_portal", organizationId: ORG, name: "Tenant", email: "tenant@t.test", emailHash: "h1" },
      { id: "cust_other", organizationId: ORG, name: "Other", email: "other@t.test", emailHash: "h2" },
    ],
    lease: [
      { id: "lease_1", customerId: "cust_portal", unitId: "unit_1", status: "ACTIVE", startDate: new Date() },
    ],
    document: [
      { id: "doc_cust", organizationId: ORG, name: "Lease.pdf", url: "https://c5k2lwc5ws.ufs.sh/f/key_cust", customerId: "cust_portal", unitId: null },
      { id: "doc_unit", organizationId: ORG, name: "Plan.pdf", url: "https://c5k2lwc5ws.ufs.sh/f/key_unit", customerId: null, unitId: "unit_1" },
      { id: "doc_other_cust", organizationId: ORG, name: "Other.pdf", url: "https://c5k2lwc5ws.ufs.sh/f/key_other", customerId: "cust_other", unitId: null },
      { id: "doc_foreign", organizationId: OTHER, name: "Foreign.pdf", url: "https://c5k2lwc5ws.ufs.sh/f/key_foreign", customerId: null, unitId: null },
    ],
  };
}

beforeEach(() => {
  seed = freshSeed();
  dbHolder.stub = makeStubDb(seed) as StubDb;
});

describe("SEC-006 — dashboard /api/documents/[id] authorization matrix", () => {
  it("unauthenticated → 307 redirect to /auth/login (no document touched)", async () => {
    setSession(null);
    const res = await documentsGet(req("/api/documents/doc_cust"), ctx("doc_cust"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/auth\/login$/);
  });

  it("authenticated without documents:read (role USER) → 403", async () => {
    setSession(asSession("u_portal", { role: "USER" }));
    const res = await documentsGet(req("/api/documents/doc_cust"), ctx("doc_cust"));
    expect(res.status).toBe(403);
  });

  it("system user (org-less, all-perms) → 403 — blocked because they are org-less (!organizationId), despite holding the permission", async () => {
    setSession(asSession("u_sys", { role: "SYSTEM_ADMIN", organizationId: null }));
    const res = await documentsGet(req("/api/documents/doc_cust"), ctx("doc_cust"));
    expect(res.status).toBe(403);
  });

  it("cross-org document id → 404 (org-scoped findFirst)", async () => {
    setSession(asSession("u_admin"));
    const res = await documentsGet(req("/api/documents/doc_foreign"), ctx("doc_foreign"));
    expect(res.status).toBe(404);
  });

  it("authorized owner → 307 redirect to a short-lived signed URL (never the raw url)", async () => {
    setSession(asSession("u_admin"));
    const res = await documentsGet(req("/api/documents/doc_cust"), ctx("doc_cust"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(SIGNED_URL);
  });
});

describe("SEC-006 — portal /api/portal/documents/[id] ownership matrix", () => {
  it("non-portal (ADMIN) identity → bounced to /auth/login", async () => {
    setSession(asSession("u_admin", { role: "ADMIN" }));
    const res = await portalDocumentsGet(req("/api/portal/documents/doc_cust"), ctx("doc_cust"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/auth\/login$/);
  });

  it("portal USER downloads their own customer document → 307 signed URL", async () => {
    setSession(asSession("u_portal", { role: "USER", email: "tenant@t.test" }));
    const res = await portalDocumentsGet(req("/api/portal/documents/doc_cust"), ctx("doc_cust"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(SIGNED_URL);
  });

  it("portal USER downloads a document on their active-lease unit → 307 signed URL", async () => {
    setSession(asSession("u_portal", { role: "USER", email: "tenant@t.test" }));
    const res = await portalDocumentsGet(req("/api/portal/documents/doc_unit"), ctx("doc_unit"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(SIGNED_URL);
  });

  it("portal USER cannot reach another customer's document → 404", async () => {
    setSession(asSession("u_portal", { role: "USER", email: "tenant@t.test" }));
    const res = await portalDocumentsGet(req("/api/portal/documents/doc_other_cust"), ctx("doc_other_cust"));
    expect(res.status).toBe(404);
  });

  it("portal USER cannot reach a cross-org document → 404", async () => {
    setSession(asSession("u_portal", { role: "USER", email: "tenant@t.test" }));
    const res = await portalDocumentsGet(req("/api/portal/documents/doc_foreign"), ctx("doc_foreign"));
    expect(res.status).toBe(404);
  });
});
