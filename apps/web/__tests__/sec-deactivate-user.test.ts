import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// QA-M2 — soft-deactivate path (setTeamMemberActive).
//
// SEC-003 enforces `isActive` + `tokenVersion` at login and in getSessionOrThrow,
// but there was no in-app way to FLIP isActive (admins had to hard-delete). This
// suite locks the new explicit, org-scoped deactivate/activate action:
//   (a) deactivating a target sets isActive=false AND bumps tokenVersion
//       (→ the target's outstanding JWT is revoked on its next action),
//   (b) a cross-org target is rejected (org-scoped updateMany → count 0 → throw),
//   (c) self-deactivation is rejected.
//
// Wired like hardening-wave-a.test.ts: a stub db that honours the where-clause +
// the REAL guards from lib/auth-helpers running against a session we set.
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unstable_cache passthrough
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: any) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => new Map() }));

import { setTeamMemberActive } from "../app/actions/team";

function user(id: string, over: Partial<Row> = {}): Row {
  return { id, role: "ADMIN", organizationId: ORG, name: "U", email: `${id}@t.test`, isActive: true, tokenVersion: 0, password: "x", ...over };
}
function asSession(id: string, over: Partial<MockUser> = {}): MockUser {
  return { id, email: `${id}@t.test`, name: "U", role: "ADMIN", organizationId: ORG, ...over };
}

function freshSeed(): Record<string, Row[]> {
  return {
    user: [
      user("u_admin"),
      user("u_target", { name: "Target" }),
      user("u_foreign", { organizationId: OTHER }),
    ],
    auditLog: [],
  };
}

beforeEach(() => {
  seed = freshSeed();
  dbHolder.stub = makeStubDb(seed) as StubDb;
  setSession(asSession("u_admin"));
});

describe("QA-M2 — setTeamMemberActive deactivation", () => {
  it("sets isActive=false AND increments tokenVersion on the org-scoped target", async () => {
    const before = seed.user!.find((u) => u.id === "u_target")!;
    expect(before.isActive).toBe(true);
    expect(before.tokenVersion).toBe(0);

    await setTeamMemberActive("u_target", false);

    const after = seed.user!.find((u) => u.id === "u_target")!;
    expect(after.isActive).toBe(false);
    expect(after.tokenVersion).toBe(1); // bump → outstanding JWT revoked (SEC-003)
  });

  it("re-activation sets isActive=true and does NOT bump tokenVersion", async () => {
    seed.user!.find((u) => u.id === "u_target")!.isActive = false;
    seed.user!.find((u) => u.id === "u_target")!.tokenVersion = 3;

    await setTeamMemberActive("u_target", true);

    const after = seed.user!.find((u) => u.id === "u_target")!;
    expect(after.isActive).toBe(true);
    expect(after.tokenVersion).toBe(3); // activation is benign — no revocation
  });
});

describe("QA-M2 — setTeamMemberActive rejects a cross-org target", () => {
  it("throws (org-scoped updateMany matches 0 rows) and leaves the foreign user untouched", async () => {
    await expect(setTeamMemberActive("u_foreign", false)).rejects.toThrow(/not found|organization/i);
    const foreign = seed.user!.find((u) => u.id === "u_foreign")!;
    expect(foreign.isActive).toBe(true);
    expect(foreign.tokenVersion).toBe(0);
  });
});

describe("QA-M2 — setTeamMemberActive blocks self-deactivation", () => {
  it("rejects deactivating your own account and does not touch the row", async () => {
    await expect(setTeamMemberActive("u_admin", false)).rejects.toThrow(/your own/i);
    const me = seed.user!.find((u) => u.id === "u_admin")!;
    expect(me.isActive).toBe(true);
    expect(me.tokenVersion).toBe(0);
  });
});
