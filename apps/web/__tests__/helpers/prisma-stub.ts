/**
 * In-memory Prisma stub for runtime server-action tests (no DB, no network).
 *
 * This is a deliberately *small* fake that implements only the handful of
 * delegate methods the tested actions actually call, with two behaviours that
 * matter for the contracts under test:
 *
 *   1. **Org-scope filtering** (§8 tenant isolation): `findFirst` / `findMany` /
 *      `findUnique` / `delete` / `update` honour a `where.organizationId`
 *      predicate, so an action run with a *foreign-org* session sees no rows —
 *      exactly as Supabase would when the production action threads
 *      `session.organizationId` into the `where`. A tenant action that *forgets*
 *      to scope by org would (correctly) NOT be caught by this stub — the point
 *      of the test is to lock the actions that DO scope, so a regression that
 *      drops the scope flips the assertion.
 *
 *   2. **Atomic conditional `updateMany`** (QA-SEC-02 coupon race): the stub's
 *      `updateMany` evaluates its `where` and applies `{ increment: 1 }`
 *      synchronously against live mutable state. Because JS runs the whole
 *      `updateMany` body on a single thread with no `await` inside, N concurrent
 *      callers are serialised exactly as Postgres serialises a conditional
 *      `UPDATE ... WHERE currentUses < cap` — so the cap holds.
 *
 * It is NOT a general Prisma emulator. Unsupported operators throw loudly so a
 * future test that needs more can't silently get a wrong answer.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: Prisma mock duck-types arbitrary row shapes
export type Row = Record<string, any> & { id: string };

type WhereLeaf =
  | { equals?: unknown; in?: unknown[]; lt?: number; gt?: number; not?: unknown }
  | string
  | number
  | boolean
  | null;

interface Where {
  [k: string]: WhereLeaf | Where[] | undefined;
  OR?: Where[];
  AND?: Where[];
}

/** P2025 — Prisma's "record not found" error for delete/update on no match. */
export class StubP2025Error extends Error {
  code = "P2025";
  constructor(model: string) {
    super(`An operation failed because it depends on one or more records that were required but not found. (${model})`);
    this.name = "PrismaClientKnownRequestError";
  }
}

function matchLeaf(actual: unknown, cond: WhereLeaf): boolean {
  if (cond === null || typeof cond !== "object") {
    return actual === cond;
  }
  if ("equals" in cond && cond.equals !== undefined) return actual === cond.equals;
  if ("in" in cond && Array.isArray(cond.in)) return cond.in.includes(actual);
  if ("lt" in cond && typeof cond.lt === "number") return typeof actual === "number" && actual < cond.lt;
  if ("gt" in cond && typeof cond.gt === "number") return typeof actual === "number" && actual > cond.gt;
  if ("not" in cond) return actual !== cond.not;
  throw new Error(`prisma-stub: unsupported where-leaf operator in ${JSON.stringify(cond)}`);
}

function matchWhere(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "OR") {
      const branches = cond as Where[];
      if (!branches.some((b) => matchWhere(row, b))) return false;
      continue;
    }
    if (key === "AND") {
      const branches = cond as Where[];
      if (!branches.every((b) => matchWhere(row, b))) return false;
      continue;
    }
    if (!matchLeaf(row[key], cond as WhereLeaf)) return false;
  }
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: write payload duck-types arbitrary columns
function applyData(row: Row, data: Record<string, any>): void {
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === "object" && "increment" in val) {
      row[key] = (row[key] ?? 0) + (val as { increment: number }).increment;
    } else if (val && typeof val === "object" && "decrement" in val) {
      row[key] = (row[key] ?? 0) - (val as { decrement: number }).decrement;
    } else {
      row[key] = val;
    }
  }
}

/** A single model delegate backed by a mutable row array. */
export function makeDelegate(model: string, rows: Row[]) {
  let seq = 0;
  return {
    findFirst: async ({ where }: { where?: Where } = {}) =>
      rows.find((r) => matchWhere(r, where)) ?? null,

    findUnique: async ({ where }: { where?: Where } = {}) =>
      rows.find((r) => matchWhere(r, where)) ?? null,

    findUniqueOrThrow: async ({ where }: { where?: Where } = {}) => {
      const found = rows.find((r) => matchWhere(r, where));
      if (!found) throw new StubP2025Error(model);
      return found;
    },

    findMany: async ({ where }: { where?: Where } = {}) =>
      rows.filter((r) => matchWhere(r, where)),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: create payload duck-types arbitrary columns
    create: async ({ data }: { data: Record<string, any> }) => {
      const row: Row = { id: data.id ?? `${model}_${++seq}`, ...data };
      rows.push(row);
      return row;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: createMany payload duck-types arbitrary columns
    createMany: async ({ data }: { data: Record<string, any>[] }) => {
      for (const d of data) rows.push({ id: d.id ?? `${model}_${++seq}`, ...d });
      return { count: data.length };
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: update payload duck-types arbitrary columns
    update: async ({ where, data }: { where?: Where; data: Record<string, any> }) => {
      const row = rows.find((r) => matchWhere(r, where));
      if (!row) throw new StubP2025Error(model);
      applyData(row, data);
      return row;
    },

    // The atomic compare-and-set used by the coupon race-guard. Runs fully
    // synchronously (no await), so concurrent callers serialise like Postgres.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: updateMany payload duck-types arbitrary columns
    updateMany: async ({ where, data }: { where?: Where; data: Record<string, any> }) => {
      const matched = rows.filter((r) => matchWhere(r, where));
      for (const r of matched) applyData(r, data);
      return { count: matched.length };
    },

    delete: async ({ where }: { where?: Where }) => {
      const idx = rows.findIndex((r) => matchWhere(r, where));
      if (idx === -1) throw new StubP2025Error(model);
      const [removed] = rows.splice(idx, 1);
      return removed;
    },

    deleteMany: async ({ where }: { where?: Where } = {}) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matchWhere(rows[i]!, where)) rows.splice(i, 1);
      }
      return { count: before - rows.length };
    },

    count: async ({ where }: { where?: Where } = {}) =>
      rows.filter((r) => matchWhere(r, where)).length,
  };
}

export interface StubDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: index signature must admit $transaction (a fn, not a delegate)
  [model: string]: ReturnType<typeof makeDelegate> | any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: $transaction takes either form (callback or promise array) and returns whatever the callback yields
  $transaction: (arg: any) => Promise<any>;
}

/**
 * Build a stub `db` from a map of model → seeded rows. Every model gets a
 * delegate over a *shared* mutable array (so writes persist within a test).
 * `$transaction` runs the callback against the same `db` (interactive form)
 * or resolves an array of promises (batch form) — no real isolation, but the
 * conditional-updateMany guard doesn't need it: it's atomic by single-thread.
 */
export function makeStubDb(seed: Record<string, Row[]>): StubDb {
  const db: StubDb = { $transaction: async () => undefined };
  for (const [model, rows] of Object.entries(seed)) {
    db[model] = makeDelegate(model, rows);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub: $transaction accepts a callback or a promise array
  db.$transaction = async (arg: any) => {
    if (typeof arg === "function") return arg(db);
    if (Array.isArray(arg)) return Promise.all(arg);
    throw new Error("prisma-stub: unsupported $transaction argument");
  };
  return db;
}
