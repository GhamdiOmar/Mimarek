/**
 * Payment Money-Correctness Test Script
 *
 * Exercises all deterministic correctness cases from spec §6 against the CI
 * ephemeral Postgres database via the raw Prisma client (NOT via Server Actions,
 * because Server Actions require a Next.js runtime context). The cases mirror
 * the logic in recordPayment / recordInstallmentPayment exactly.
 *
 * Concurrency note (spec §6):
 *   True parallel-goroutine races cannot be reproduced deterministically from a
 *   single Node process. Instead we:
 *   - Assert the structural guard: the @@unique([leaseId, paymentReference])
 *     constraint exists at the DB level (verified by attempting a duplicate raw
 *     INSERT and confirming it throws P2002).
 *   - Cover the same-key sequential-replay path with an explicit second call
 *     using the identical paymentReference — confirming paidAmount is NOT doubled.
 *
 * Usage:
 *   npx tsx e2e/seed/payment-correctness-test.ts
 *
 * Prerequisites:
 *   - DATABASE_URL set in environment
 *   - Schema applied via `prisma db push`
 *   - Main seed + billing seed already run (org + user exist)
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { effectivePaid } from "../../lib/money";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function assertEq(actual: number, expected: number, label: string, epsilon = 0.001): void {
  const ok = Math.abs(actual - expected) < epsilon;
  if (ok) {
    console.log(`  ✅ ${label} (got ${actual})`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

/** Create a minimal org → customer → unit → lease → installment chain, return installmentId */
async function createInstallment(
  orgId: string,
  amount: number,
  status: "UNPAID" | "OVERDUE" | "PARTIALLY_PAID" | "PAID" = "UNPAID",
  paidAmount?: number,
): Promise<{ installmentId: string; leaseId: string }> {
  const customer = await prisma.customer.create({
    data: {
      name: `Test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      phone: `05${Math.floor(10000000 + Math.random() * 90000000)}`,
      organizationId: orgId,
    },
  });
  const unit = await prisma.unit.create({
    data: {
      number: `U-${Math.random().toString(36).slice(2, 7)}`,
      organizationId: orgId,
      type: "APARTMENT",
      status: "RENTED",
      city: "Riyadh",
    },
  });
  const lease = await prisma.lease.create({
    data: {
      organizationId: orgId,
      unitId: unit.id,
      customerId: customer.id,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      totalAmount: amount,
      status: "ACTIVE",
    },
  });
  const installment = await prisma.rentInstallment.create({
    data: {
      leaseId: lease.id,
      dueDate: new Date("2026-02-01"),
      amount,
      status,
      paidAmount: paidAmount ?? null,
    },
  });
  return { installmentId: installment.id, leaseId: lease.id };
}

/**
 * Inline recordPayment logic — mirrors the ledger server-action path (I2):
 * idempotency on the immutable RentPayment row keyed by (installmentId,
 * idempotencyKey=paymentReference), append the ledger row, recompute the cache
 * from SUM(RentPayment.amount), and persist paidAmount/status onto the installment.
 */
async function doRecordPayment(
  installmentId: string,
  payAmount: number,
  paymentReference: string,
  paidAtDate = new Date(),
): Promise<{ row: any; replayed: boolean }> {
  type LockedRow = {
    id: string;
    leaseId: string;
    amount: string;
    paidAmount: string | null;
    status: string;
    organizationId: string;
  };

  return prisma.$transaction(async (tx) => {
    // Idempotency short-circuit — now on the RentPayment ledger row.
    const priorPayment = await tx.rentPayment.findUnique({
      where: {
        installmentId_idempotencyKey: { installmentId, idempotencyKey: paymentReference },
      },
      include: { installment: true },
    });
    if (priorPayment) {
      return { row: priorPayment.installment, replayed: true };
    }

    // Lock the installment row (now also selects leaseId for the ledger insert).
    const locked = await tx.$queryRaw<LockedRow[]>`
      SELECT ri.id,
             ri."leaseId" AS "leaseId",
             ri.amount::text AS amount,
             ri."paidAmount"::text AS "paidAmount",
             ri.status::text AS status,
             c."organizationId" AS "organizationId"
      FROM "RentInstallment" ri
      JOIN "Lease" l ON l.id = ri."leaseId"
      JOIN "Customer" c ON c.id = l."customerId"
      WHERE ri.id = ${installmentId}
      FOR UPDATE OF ri
    `;
    const row = locked[0];
    if (!row) throw new Error("Installment not found");
    if (row.status === "PAID") throw new Error("ALREADY_PAID");

    const installmentAmount = Number(row.amount);
    const priorPaid = Number(row.paidAmount ?? 0);
    const projected = priorPaid + payAmount;

    if (projected > installmentAmount + 0.005) {
      throw new Error("OVERPAY");
    }

    // Append the immutable ledger row.
    await tx.rentPayment.create({
      data: {
        installmentId,
        leaseId: row.leaseId,
        amount: payAmount,
        txType: "PAYMENT",
        idempotencyKey: paymentReference,
        channel: "BANK_TRANSFER",
      },
    });

    // Recompute the cache from the ledger SUM.
    const agg = await tx.rentPayment.aggregate({
      where: { installmentId },
      _sum: { amount: true },
    });
    const newPaidAmount = Number(agg._sum.amount ?? 0);
    const newStatus =
      newPaidAmount >= installmentAmount - 0.005 ? "PAID" : "PARTIALLY_PAID";

    const updated = await tx.rentInstallment.update({
      where: { id: installmentId },
      data: {
        status: newStatus as any,
        paidAmount: newPaidAmount,
        paidAt: paidAtDate,
        paymentMethod: "BANK_TRANSFER",
        paymentReference,
      },
    });

    return { row: updated, replayed: false };
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n💰 Payment Money-Correctness Tests\n");

  // Get a test org from the seed
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.error("❌ No organization found. Run the main seed first.");
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`🏢 Using org: ${org.name} (${org.id})\n`);

  // ─── Case 1: Single partial payment ────────────────────────────────────────
  console.log("Case 1: Single partial payment");
  {
    const { installmentId } = await createInstallment(org.id, 1000);
    const ref = `ref-partial-${Date.now()}`;
    const { row } = await doRecordPayment(installmentId, 400, ref);
    assertEq(Number(row.paidAmount), 400, "paidAmount == 400");
    assert(row.status === "PARTIALLY_PAID", "status == PARTIALLY_PAID");
    assert(row.paidAt !== null, "paidAt is set on partial");
    assert(row.paymentReference === ref, "paymentReference stored");
  }

  // ─── Case 2: Partial → Complete (two sequential payments) ──────────────────
  console.log("\nCase 2: Partial → Complete");
  {
    const { installmentId } = await createInstallment(org.id, 1000);
    await doRecordPayment(installmentId, 600, `ref-p2c-a-${Date.now()}`);
    const { row } = await doRecordPayment(installmentId, 400, `ref-p2c-b-${Date.now()}`);
    assertEq(Number(row.paidAmount), 1000, "paidAmount == 1000 after two payments");
    assert(row.status === "PAID", "status == PAID after completing");
  }

  // ─── Case 3: Exact full payment ────────────────────────────────────────────
  console.log("\nCase 3: Exact full payment");
  {
    const { installmentId } = await createInstallment(org.id, 500);
    const { row } = await doRecordPayment(installmentId, 500, `ref-exact-${Date.now()}`);
    assertEq(Number(row.paidAmount), 500, "paidAmount == 500");
    assert(row.status === "PAID", "status == PAID");
    assert(row.paidAt !== null, "paidAt set");
  }

  // ─── Case 4: Overpay rejected before any payment ───────────────────────────
  console.log("\nCase 4: Overpay rejected (fresh installment)");
  {
    const { installmentId } = await createInstallment(org.id, 300);
    let threw = false;
    try {
      await doRecordPayment(installmentId, 500, `ref-overpay-${Date.now()}`);
    } catch (e: any) {
      threw = e.message === "OVERPAY";
    }
    assert(threw, "overpay throws OVERPAY");
    // Row must be unchanged
    const ri = await prisma.rentInstallment.findUnique({ where: { id: installmentId } });
    assert(ri?.status === "UNPAID", "status still UNPAID after rejected overpay");
    assert(ri?.paidAmount === null, "paidAmount still null");
  }

  // ─── Case 5: Overpay rejected after partial ─────────────────────────────────
  console.log("\nCase 5: Overpay rejected after partial");
  {
    const { installmentId } = await createInstallment(org.id, 1000);
    await doRecordPayment(installmentId, 700, `ref-op-a-${Date.now()}`);
    let threw = false;
    try {
      await doRecordPayment(installmentId, 400, `ref-op-b-${Date.now()}`); // 700+400 > 1000+0.005
    } catch (e: any) {
      threw = e.message === "OVERPAY";
    }
    assert(threw, "overpay throws after partial");
    const ri = await prisma.rentInstallment.findUnique({ where: { id: installmentId } });
    assertEq(Number(ri?.paidAmount ?? 0), 700, "paidAmount still 700 after rejected overpay");
  }

  // ─── Case 6: Idempotent same-key double submit — paidAmount NOT doubled ─────
  console.log("\nCase 6: Idempotent same-key double submit");
  {
    const { installmentId } = await createInstallment(org.id, 1000);
    const ref = `ref-idem-${Date.now()}`;
    const { row: r1, replayed: rep1 } = await doRecordPayment(installmentId, 400, ref);
    const { row: r2, replayed: rep2 } = await doRecordPayment(installmentId, 400, ref);
    assert(!rep1, "first call is NOT replayed");
    assert(rep2, "second call IS replayed");
    assertEq(Number(r1.paidAmount), 400, "first call paidAmount == 400");
    assertEq(Number(r2.paidAmount), 400, "second call paidAmount == 400 (not 800)");
    // Confirm DB state
    const ri = await prisma.rentInstallment.findUnique({ where: { id: installmentId } });
    assertEq(Number(ri?.paidAmount ?? 0), 400, "DB paidAmount == 400 (not doubled)");
  }

  // ─── Case 7: Already-PAID guard ────────────────────────────────────────────
  console.log("\nCase 7: Already-PAID guard");
  {
    const { installmentId } = await createInstallment(org.id, 500);
    await doRecordPayment(installmentId, 500, `ref-paid-a-${Date.now()}`);
    let threw = false;
    try {
      await doRecordPayment(installmentId, 100, `ref-paid-b-${Date.now()}`);
    } catch (e: any) {
      threw = e.message === "ALREADY_PAID";
    }
    assert(threw, "second payment on PAID installment throws ALREADY_PAID");
  }

  // ─── Case 8: markOverdueInstallments includes PARTIALLY_PAID ───────────────
  console.log("\nCase 8: markOverdueInstallments includes PARTIALLY_PAID");
  {
    const pastDue = new Date("2024-01-01");
    // Create one UNPAID past-due and one PARTIALLY_PAID past-due
    const customer = await prisma.customer.create({
      data: {
        name: `OD-Test-${Date.now()}`,
        phone: `05${Math.floor(10000000 + Math.random() * 90000000)}`,
        organizationId: org.id,
      },
    });
    const unit = await prisma.unit.create({
      data: { number: `ODU-${Math.random().toString(36).slice(2, 7)}`, organizationId: org.id, type: "APARTMENT", status: "RENTED", city: "Riyadh" },
    });
    const lease = await prisma.lease.create({
      data: { organizationId: org.id, unitId: unit.id, customerId: customer.id, startDate: new Date("2024-01-01"), endDate: new Date("2024-12-31"), totalAmount: 2000, status: "ACTIVE" },
    });
    const unpaidInst = await prisma.rentInstallment.create({
      data: { leaseId: lease.id, dueDate: pastDue, amount: 1000, status: "UNPAID" },
    });
    const partialInst = await prisma.rentInstallment.create({
      data: { leaseId: lease.id, dueDate: pastDue, amount: 1000, status: "PARTIALLY_PAID", paidAmount: 200 },
    });

    // Run the updateMany matching markOverdueInstallments logic
    await prisma.rentInstallment.updateMany({
      where: {
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        dueDate: { lt: new Date() },
        lease: { customer: { organizationId: org.id } },
      },
      data: { status: "OVERDUE" },
    });

    const after1 = await prisma.rentInstallment.findUnique({ where: { id: unpaidInst.id } });
    const after2 = await prisma.rentInstallment.findUnique({ where: { id: partialInst.id } });
    assert(after1?.status === "OVERDUE", "UNPAID past-due → OVERDUE");
    assert(after2?.status === "OVERDUE", "PARTIALLY_PAID past-due → OVERDUE");
    // paidAmount preserved on PARTIALLY_PAID→OVERDUE
    assertEq(Number(after2?.paidAmount ?? 0), 200, "paidAmount=200 preserved after →OVERDUE");
  }

  // ─── Case 9: Metrics — effectivePaid with mixed seed incl. legacy rows ──────
  console.log("\nCase 9: Metrics — effectivePaid with mixed statuses");
  {
    const customer = await prisma.customer.create({
      data: {
        name: `Metrics-${Date.now()}`,
        phone: `05${Math.floor(10000000 + Math.random() * 90000000)}`,
        organizationId: org.id,
      },
    });
    const unit = await prisma.unit.create({
      data: { number: `MU-${Math.random().toString(36).slice(2, 7)}`, organizationId: org.id, type: "APARTMENT", status: "RENTED", city: "Riyadh" },
    });
    const lease = await prisma.lease.create({
      data: { organizationId: org.id, unitId: unit.id, customerId: customer.id, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), totalAmount: 3000, status: "ACTIVE" },
    });

    // Row A: PAID with paidAmount=null (legacy — was fully paid before paidAmount column)
    const rowA = await prisma.rentInstallment.create({
      data: { leaseId: lease.id, dueDate: new Date("2026-02-01"), amount: 1000, status: "PAID", paidAmount: null },
    });
    // Row B: OVERDUE with paidAmount=200 (partial that aged to overdue)
    const rowB = await prisma.rentInstallment.create({
      data: { leaseId: lease.id, dueDate: new Date("2025-12-01"), amount: 1000, status: "OVERDUE", paidAmount: 200 },
    });
    // Row C: UNPAID with nothing paid
    const rowC = await prisma.rentInstallment.create({
      data: { leaseId: lease.id, dueDate: new Date("2026-03-01"), amount: 1000, status: "UNPAID", paidAmount: null },
    });

    const rows = [rowA, rowB, rowC].map(r => ({ ...r, amount: r.amount.toString(), paidAmount: r.paidAmount?.toString() ?? null }));

    // effectivePaid: A=1000 (PAID+null→amount), B=200 (OVERDUE→paidAmount), C=0
    const collected = rows.reduce((s, r) => s + effectivePaid(r), 0);
    assertEq(collected, 1200, "collected=1200 (1000+200+0) — OVERDUE partial counts, legacy PAID/null counts amount");

    // AR = remaining on UNPAID/PARTIALLY_PAID/OVERDUE
    const ar = rows
      .filter(r => ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(r.status))
      .reduce((s, r) => s + (Number(r.amount) - Number(r.paidAmount ?? 0)), 0);
    // B: 1000-200=800, C: 1000-0=1000 → total 1800
    assertEq(ar, 1800, "AR=1800 (800 OVERDUE remaining + 1000 UNPAID)");
  }

  // ─── Case 10: Unique constraint structural guard ────────────────────────────
  // True parallel concurrency is not reliably testable in a single Node process.
  // We assert the constraint exists by trying a raw duplicate INSERT and
  // confirming it fails with a unique-constraint error (Prisma P2002).
  console.log("\nCase 10: @@unique([leaseId, paymentReference]) structural guard");
  {
    const { installmentId, leaseId } = await createInstallment(org.id, 500);
    const ref = `ref-constraint-${Date.now()}`;

    // First insert via the normal path
    await doRecordPayment(installmentId, 100, ref);

    // Try to force a second row with the same leaseId+paymentReference via raw update on a DIFFERENT installment
    const { installmentId: inst2 } = await createInstallment(org.id, 500);
    // Override its leaseId to same lease so the unique pair collides
    await prisma.$executeRaw`
      UPDATE "RentInstallment"
      SET "leaseId" = ${leaseId}
      WHERE id = ${inst2}
    `;

    let constraintHit = false;
    try {
      await prisma.rentInstallment.update({
        where: { id: inst2 },
        data: { paymentReference: ref },
      });
    } catch (e: any) {
      constraintHit = e?.code === "P2002";
    }
    assert(constraintHit, "@@unique([leaseId, paymentReference]) blocks duplicate key (P2002)");
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("─────────────────────────────────────────\n");

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Test script failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
