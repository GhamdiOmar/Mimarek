import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// SEC-016 — authorized marketplace deed-document download route.
//
// Locks the authz matrix of GET /api/marketplace/deed/[transferId]:
//   • unauthenticated                      → 307 redirect to /auth/login
//   • tenant user from a DIFFERENT org      → 403
//   • the owning seller org (transfer:execute) → 307 to the signed URL
//   • a system moderator (marketplace:moderate) → 307 to the signed URL
//   • missing transfer                      → 404
//
// Wired like hardening-wave-a.test.ts: a stub db that honours the where-clause +
// the REAL guards (getSessionOrThrow / hasPermission / isSystemRole) running
// against a session we set. `uploadthing/server` UTApi is mocked so no network /
// no real signing key is needed.
// ─────────────────────────────────────────────────────────────────────────────

const SELLER_ORG = "org_seller";
const OTHER_ORG = "org_other";
const SIGNED_URL = "https://c5k2lwc5ws.ufs.sh/f/SIGNED-deed-key?expires=soon";

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
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => new Map() }));

// Mock the UploadThing server SDK so generateSignedURL returns a fixed ufsUrl
// (no network, no signing key). UTApi must be a real constructor (the route does
// `new UTApi()`), so use a class — a `vi.fn().mockImplementation` is NOT newable.
const generateSignedURL = vi.fn(async () => ({ ufsUrl: SIGNED_URL }));
vi.mock("uploadthing/server", () => ({
  UTApi: class {
    generateSignedURL = generateSignedURL;
  },
}));

import { GET } from "../app/api/marketplace/deed/[transferId]/route";

function user(id: string, over: Partial<Row> = {}): Row {
  return {
    id,
    role: "ADMIN",
    organizationId: SELLER_ORG,
    name: "U",
    email: `${id}@t.test`,
    isActive: true,
    tokenVersion: 0,
    password: "x",
    ...over,
  };
}
function asSession(id: string, over: Partial<MockUser> = {}): MockUser {
  return { id, email: `${id}@t.test`, name: "U", role: "ADMIN", organizationId: SELLER_ORG, ...over };
}

function freshSeed(): Record<string, Row[]> {
  return {
    user: [
      user("u_seller"), // ADMIN in SELLER_ORG → marketplace:transfer:execute, owns the transfer
      user("u_other", { organizationId: OTHER_ORG }), // ADMIN in a different org
      user("u_sys", { role: "SYSTEM_ADMIN", organizationId: null }), // platform moderator
    ],
    // findUnique in the stub ignores `include` and returns the row verbatim, so we
    // seed the nested `transfer` shape the route reads (transfer.sellerOrgId).
    marketplaceDeedProof: [
      {
        id: "proof_1",
        transferId: "xfer_1",
        deedDocKey: "deed-key-abc",
        deedDocUrl: null,
        transfer: { sellerOrgId: SELLER_ORG },
      },
    ],
    auditLog: [], // logAuditEvent writes here (fire-and-forget); seed so create() doesn't explode
  };
}

function req(transferId: string): { request: Request; params: Promise<{ transferId: string }> } {
  return {
    request: new Request(`https://app.test/api/marketplace/deed/${transferId}`),
    params: Promise.resolve({ transferId }),
  };
}

beforeEach(() => {
  seed = freshSeed();
  dbHolder.stub = makeStubDb(seed) as StubDb;
  generateSignedURL.mockClear();
});

describe("SEC-016 — deed-document download authz matrix", () => {
  it("unauthenticated → 307 redirect to /auth/login", async () => {
    setSession(null);
    const { request, params } = req("xfer_1");
    const res = await GET(request, { params });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login");
    expect(generateSignedURL).not.toHaveBeenCalled();
  });

  it("tenant user from a DIFFERENT org → 403", async () => {
    setSession(asSession("u_other", { organizationId: OTHER_ORG }));
    const { request, params } = req("xfer_1");
    const res = await GET(request, { params });
    expect(res.status).toBe(403);
    expect(generateSignedURL).not.toHaveBeenCalled();
  });

  it("owning seller org (marketplace:transfer:execute) → 307 to the signed URL", async () => {
    setSession(asSession("u_seller"));
    const { request, params } = req("xfer_1");
    const res = await GET(request, { params });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(SIGNED_URL);
    expect(generateSignedURL).toHaveBeenCalledWith("deed-key-abc", { expiresIn: 60 * 15 });
  });

  it("system moderator (marketplace:moderate) → 307 to the signed URL", async () => {
    setSession(asSession("u_sys", { role: "SYSTEM_ADMIN", organizationId: null }));
    const { request, params } = req("xfer_1");
    const res = await GET(request, { params });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(SIGNED_URL);
    expect(generateSignedURL).toHaveBeenCalledTimes(1);
  });

  it("missing transfer → 404", async () => {
    setSession(asSession("u_seller"));
    const { request, params } = req("xfer_missing");
    const res = await GET(request, { params });
    expect(res.status).toBe(404);
    expect(generateSignedURL).not.toHaveBeenCalled();
  });

  it("legacy deedDocUrl-only proof → 307 to that URL (back-compat)", async () => {
    seed.marketplaceDeedProof![0] = {
      id: "proof_2",
      transferId: "xfer_legacy",
      deedDocKey: null,
      deedDocUrl: "https://example.com/legacy-deed.pdf",
      transfer: { sellerOrgId: SELLER_ORG },
    };
    setSession(asSession("u_seller"));
    const { request, params } = req("xfer_legacy");
    const res = await GET(request, { params });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://example.com/legacy-deed.pdf");
    expect(generateSignedURL).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-016 (P3-1) — the deed fileKey is SERVER-AUTHORITATIVE: the uploader binds it
// to a verified-owned transfer, and the submit action no longer trusts a client key.
// Source-level lock (the UploadThing middleware can't be unit-invoked without the
// UT runtime), mirroring the zatca-issuance-hooks source-assertion pattern.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("SEC-016 P3-1 — upload binds the deed key to a verified-owned transfer", () => {
  const core = readFileSync(resolve(process.cwd(), "app/api/uploadthing/core.ts"), "utf8");
  const action = readFileSync(resolve(process.cwd(), "app/actions/marketplace.ts"), "utf8");

  it("deedProofUploader middleware verifies the transfer belongs to the seller org", () => {
    expect(core).toMatch(/\.input\(z\.object\(\{ transferId/);
    // ownership check: findFirst on the transfer scoped by sellerOrgId === caller's org
    expect(core).toMatch(/unitTransferTransaction\.findFirst[\s\S]*sellerOrgId: organizationId/);
  });

  it("deedProofUploader writes the key server-side (onUploadComplete upsert)", () => {
    expect(core).toMatch(/onUploadComplete[\s\S]*marketplaceDeedProof\.upsert[\s\S]*deedDocKey: fileKey/);
  });

  it("submitDeedTransferProof no longer reads a client-supplied deedDocKey", () => {
    // The submit action must never touch a caller-supplied key — the upload writes it.
    expect(action).not.toMatch(/payload\.deedDocKey/);
    expect(action).not.toMatch(/DeedProofSubmitPayload[\s\S]*deedDocKey\?/);
  });
});
