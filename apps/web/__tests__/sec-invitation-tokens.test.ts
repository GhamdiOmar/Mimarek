import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "crypto";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// SEC-014 — invitation bearer tokens are hashed at rest (OWASP: hash-at-rest).
//
// The RAW token (random UUID) lives ONLY in the emailed invite URL; the DB
// `token` column stores ONLY sha256Hex(rawToken), mirroring
// passwordResetToken.tokenHash. So a DB read cannot forge a redeemable invite.
//
// Wired like hardening-wave-a.test.ts: a stub db that honours the where-clause +
// the REAL guards from lib/auth-helpers running against a session we set. The
// external dependencies (rate-limit, entitlements, email) are stubbed so the
// create→find round-trip exercises the real sha256Hex hashing end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

const ORG = "org_a";

/** Independent reference hash — must match lib/token-hash.sha256Hex. */
function refHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

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

// Rate-limit is Postgres-backed in prod — stub so the invite path never trips it
// and never touches a real counter table.
vi.mock("../lib/rate-limit", () => ({
  peekRateLimit: async () => ({ allowed: true }),
  checkRateLimit: async () => ({ allowed: true }),
}));
// Entitlements quota check — always granted in test.
vi.mock("../lib/entitlements", () => ({
  checkLimit: async () => ({ granted: true }),
  FEATURE_KEYS: { USERS_MAX: "USERS_MAX" },
}));
// Transactional email — never actually send; record the call. Hoisted so the
// (hoisted) vi.mock factory can reference it.
const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ ok: true, code: "SENT", message: "ok" })),
}));
vi.mock("../lib/email", () => ({ sendTransactionalEmail: sendEmail }));
// Deterministic app URL so we can parse the invite URL's token segment.
vi.mock("../lib/app-url", () => ({ getAppUrl: () => "https://app.test" }));

import { createInvitation, getInvitationByToken } from "../app/actions/invitations";

function user(id: string, over: Partial<Row> = {}): Row {
  return { id, role: "ADMIN", organizationId: ORG, name: "U", email: `${id}@t.test`, isActive: true, tokenVersion: 0, password: "x", ...over };
}
function asSession(id: string, over: Partial<MockUser> = {}): MockUser {
  return { id, email: `${id}@t.test`, name: "U", role: "ADMIN", organizationId: ORG, ...over };
}

function freshSeed(): Record<string, Row[]> {
  return {
    user: [user("u_admin")],
    organization: [{ id: ORG, name: "Org A", appStatus: "ACTIVE" }],
    invitation: [],
  };
}

/** Pull the token segment out of `.../auth/invite/<token>`. */
function tokenFromUrl(url: string): string {
  return url.split("/auth/invite/")[1]!;
}

beforeEach(() => {
  seed = freshSeed();
  const stub = makeStubDb(seed) as StubDb;
  // createInvitation reads invitation.organization.name + invitation.invitedBy.name
  // for the email template (an `include` the minimal stub doesn't resolve). Wrap
  // create() to attach those relations on the returned row. The persisted `token`
  // (the value under test) flows through unchanged.
  const realCreate = stub.invitation.create;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub augmentation
  stub.invitation.create = async (args: any) => {
    const row = await realCreate(args);
    row.organization = { name: "Org A" };
    row.invitedBy = { name: "U" };
    return row;
  };
  dbHolder.stub = stub;
  setSession(asSession("u_admin"));
  sendEmail.mockClear();
});

describe("SEC-014 — createInvitation hashes the token at rest", () => {
  it("persists a hash that is NOT the raw URL token, and equals sha256Hex(urlToken)", async () => {
    const res = await createInvitation({ email: "new@t.test", role: "USER" });
    expect(res.success).toBe(true);

    const urlToken = tokenFromUrl(res.inviteUrl!);
    const stored = seed.invitation!.find((i) => i.email === "new@t.test")!;

    // (a) the stored column is NOT the raw token from the URL …
    expect(stored.token).not.toBe(urlToken);
    // … and it IS the SHA-256 hash of that raw token.
    expect(stored.token).toBe(refHash(urlToken));
    // sanity: a 64-hex-char digest, not a UUID
    expect(stored.token).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("SEC-014 — getInvitationByToken hashes the incoming token", () => {
  it("finds the invite with the RAW token (end-to-end hashing works)", async () => {
    const res = await createInvitation({ email: "find@t.test", role: "USER" });
    const urlToken = tokenFromUrl(res.inviteUrl!);

    const found = await getInvitationByToken(urlToken);
    expect(found.valid).toBe(true);
    expect(found.email).toBe("find@t.test");
  });

  it("does NOT find the invite with a wrong / unhashed token", async () => {
    await createInvitation({ email: "find2@t.test", role: "USER" });

    const miss = await getInvitationByToken("raw-but-unhashed-wrong");
    expect(miss.valid).toBe(false);
  });

  it("does NOT find the invite when passed the stored HASH directly (the hash is not a valid bearer token)", async () => {
    const res = await createInvitation({ email: "find3@t.test", role: "USER" });
    const stored = seed.invitation!.find((i) => i.email === "find3@t.test")!;
    // Passing the at-rest hash re-hashes it → double-hash → no match. Confirms the
    // stored value alone cannot be replayed against the lookup.
    const miss = await getInvitationByToken(stored.token);
    expect(miss.valid).toBe(false);

    // sanity: the matching raw token still resolves
    const ok = await getInvitationByToken(tokenFromUrl(res.inviteUrl!));
    expect(ok.valid).toBe(true);
  });
});
