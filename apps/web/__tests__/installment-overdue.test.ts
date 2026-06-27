import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";

// ─────────────────────────────────────────────────────────────────────────────
// HARDENING WAVE B — runtime proof for the orphaned-sweep fix.
//
// `markOverdueInstallmentsInternal` is the production writer of
// RentInstallment.status="OVERDUE". Before Wave B it had no caller (the sweep
// was orphaned); it is now wired to a CRON_SECRET-gated cron route and guarded by
// the check-cron-coverage CI gate. This locks the SWEEP LOGIC itself: only
// past-due UNPAID / PARTIALLY_PAID rows flip — PAID, future, and already-OVERDUE
// rows are left untouched.
// ─────────────────────────────────────────────────────────────────────────────

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

import { markOverdueInstallmentsInternal } from "../lib/server/installment-overdue";

const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

function freshSeed(): Record<string, Row[]> {
  return {
    rentInstallment: [
      { id: "past_unpaid", status: "UNPAID", dueDate: PAST },
      { id: "past_partial", status: "PARTIALLY_PAID", dueDate: PAST },
      { id: "past_paid", status: "PAID", dueDate: PAST },
      { id: "future_unpaid", status: "UNPAID", dueDate: FUTURE },
      { id: "already_overdue", status: "OVERDUE", dueDate: PAST },
    ],
  };
}

beforeEach(() => {
  seed = freshSeed();
  dbHolder.stub = makeStubDb(seed) as StubDb;
});

describe("markOverdueInstallmentsInternal", () => {
  it("flips ONLY past-due UNPAID / PARTIALLY_PAID rows to OVERDUE", async () => {
    const result = await markOverdueInstallmentsInternal();
    expect(result.overdue).toBe(2);

    const byId = (id: string) => seed.rentInstallment!.find((r) => r.id === id)!;
    expect(byId("past_unpaid").status).toBe("OVERDUE");
    expect(byId("past_partial").status).toBe("OVERDUE");
  });

  it("leaves PAID, not-yet-due, and already-OVERDUE rows untouched", async () => {
    await markOverdueInstallmentsInternal();
    const byId = (id: string) => seed.rentInstallment!.find((r) => r.id === id)!;
    expect(byId("past_paid").status).toBe("PAID");
    expect(byId("future_unpaid").status).toBe("UNPAID");
    expect(byId("already_overdue").status).toBe("OVERDUE");
  });

  it("is idempotent — a second run flips nothing new", async () => {
    await markOverdueInstallmentsInternal();
    const second = await markOverdueInstallmentsInternal();
    expect(second.overdue).toBe(0);
  });
});
