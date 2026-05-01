/**
 * seed-demo.ts — Rich demo data for dashboard KPIs
 * Run: pnpm --filter @repo/db seed:demo
 *
 * Adds to the Mimaric org (admin@mimaric.sa):
 *  • 6 extra customers  (fills CRM pipeline stages)
 *  • 3 reservations     (activeDeals KPI)
 *  • 4 signed contracts + payment plans
 *  • Installments: some PAID this month (monthlyRevenue), one OVERDUE (pendingPayments)
 *  • 5 extra maintenance requests
 *
 * Safe to re-run — skips if contracts already exist.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not defined");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const now = new Date();
const thisMonth = (day: number) =>
  new Date(now.getFullYear(), now.getMonth(), day);
const pastDate = (y: number, m: number, d: number) => new Date(y, m - 1, d);

async function main() {
  console.log("🌱  Seeding demo data...");

  const org = await prisma.organization.findFirst({
    where: { crNumber: "1010342981" },
  });
  if (!org) throw new Error("Mimaric org not found — run main seed first");

  const units = await prisma.unit.findMany({
    where: { organizationId: org.id },
    orderBy: { number: "asc" },
  });
  if (units.length === 0)
    throw new Error("No units found — run main seed first");

  const adminUser = await prisma.user.findFirst({
    where: { email: "admin@mimaric.sa" },
  });

  // Guard: skip if contracts already exist
  const existingContracts = await prisma.contract.count({
    where: { customer: { organizationId: org.id } },
  });
  if (existingContracts > 0) {
    console.log(
      `⚠️  Demo data already exists (${existingContracts} contracts). Skipping.`,
    );
    return;
  }

  // ── Unit helpers ────────────────────────────────────────────────────────
  const u = (num: string) => units.find((x) => x.number === num);

  // ── Extra Customers ──────────────────────────────────────────────────────
  const [khalid, reem, omar, hessa, turki, mona] = await Promise.all([
    prisma.customer.create({
      data: {
        name: "Khalid Al-Ghamdi",
        nameArabic: "خالد عبدالله الغامدي",
        phone: "0501112222",
        email: "k.ghamdi@gmail.com",
        nationalId: "1067890123",
        personType: "SAUDI_CITIZEN",
        gender: "MALE",
        status: "CONTACTED",
        source: "Website",
        budget: 1200000,
        organizationId: org.id,
        agentId: adminUser?.id,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Reem Al-Harbi",
        nameArabic: "ريم أحمد الحربي",
        phone: "0557778888",
        email: "reem.h@icloud.com",
        nationalId: "1078901234",
        personType: "SAUDI_CITIZEN",
        gender: "FEMALE",
        status: "NEGOTIATION",
        source: "Exhibition",
        budget: 2800000,
        organizationId: org.id,
        agentId: adminUser?.id,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Omar Al-Zahrani",
        nameArabic: "عمر سعيد الزهراني",
        phone: "0531234567",
        email: "omar.z@outlook.com",
        nationalId: "1089012345",
        personType: "SAUDI_CITIZEN",
        gender: "MALE",
        status: "CONVERTED",
        source: "Referral",
        budget: 850000,
        organizationId: org.id,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Hessa Al-Dawsari",
        nameArabic: "حصة خالد الدوسري",
        phone: "0564445566",
        email: "hessa.d@gmail.com",
        nationalId: "1090123456",
        personType: "SAUDI_CITIZEN",
        gender: "FEMALE",
        status: "CONVERTED",
        source: "Walk-in",
        budget: 720000,
        organizationId: org.id,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Turki Al-Anzi",
        nameArabic: "تركي محمد العنزي",
        phone: "0505556677",
        nationalId: "1101234567",
        personType: "SAUDI_CITIZEN",
        gender: "MALE",
        status: "LOST",
        lostReason: "Found a competitor offer",
        source: "Social Media",
        organizationId: org.id,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Mona Al-Otaibi",
        nameArabic: "منى عبدالرحمن العتيبي",
        phone: "0516667788",
        email: "mona.o@yahoo.com",
        nationalId: "1112345678",
        personType: "SAUDI_CITIZEN",
        gender: "FEMALE",
        status: "QUALIFIED",
        source: "Referral",
        budget: 980000,
        organizationId: org.id,
        agentId: adminUser?.id,
      },
    }),
  ]);
  console.log("Created 6 extra customers");

  // ── Reservations (activeDeals) ───────────────────────────────────────────
  // Get existing customers too
  const existingCustomers = await prisma.customer.findMany({
    where: { organizationId: org.id },
  });
  const findC = (name: string) => existingCustomers.find((c) => c.name === name);

  const mohammed = findC("Mohammed Al-Qahtani");
  const unitA201 = u("A-201");
  const unitB201 = u("B-201");
  const unitC102 = u("C1-02");

  if (mohammed && unitA201) {
    await prisma.reservation.create({
      data: {
        customerId: mohammed.id,
        unitId: unitA201.id,
        userId: adminUser?.id,
        status: "CONFIRMED",
        expiresAt: new Date("2026-05-15"),
        amount: 50000,
        depositRequired: true,
        depositAmount: 50000,
        depositPaidAt: pastDate(2026, 4, 10),
      },
    });
  }
  if (reem && unitB201) {
    await prisma.reservation.create({
      data: {
        customerId: reem.id,
        unitId: unitB201.id,
        userId: adminUser?.id,
        status: "PENDING",
        expiresAt: new Date("2026-05-01"),
        amount: 100000,
      },
    });
  }
  if (khalid && unitC102) {
    await prisma.reservation.create({
      data: {
        customerId: khalid.id,
        unitId: unitC102.id,
        userId: adminUser?.id,
        status: "PENDING",
        expiresAt: new Date("2026-04-30"),
        amount: 30000,
      },
    });
  }
  console.log("Created 3 reservations (1 CONFIRMED, 2 PENDING)");

  // ── Contract helpers ─────────────────────────────────────────────────────
  async function makeContract(
    customer: { id: string },
    unitId: string,
    contractNumber: string,
    amount: number,
    signedAt: Date,
    installments: {
      num: number;
      amount: number;
      due: Date;
      paid: boolean;
      paidAt: Date | null;
      overdue?: boolean;
    }[],
  ) {
    const contract = await prisma.contract.create({
      data: {
        customerId: customer.id,
        unitId,
        userId: adminUser?.id,
        status: "SIGNED",
        type: "SALE",
        contractNumber,
        amount,
        signedAt,
        buyerSignedAt: signedAt,
      },
    });
    const plan = await prisma.paymentPlan.create({
      data: {
        contractId: contract.id,
        name: `${installments.length}-Installment Plan`,
        totalAmount: amount,
        downPayment: installments[0]!.amount,
        status: "ACTIVE_PLAN",
        organizationId: org.id,
      },
    });
    for (const ins of installments) {
      await prisma.paymentPlanInstallment.create({
        data: {
          paymentPlanId: plan.id,
          installmentNumber: ins.num,
          amount: ins.amount,
          dueDate: ins.due,
          status: ins.overdue ? "OVERDUE" : ins.paid ? "PAID" : "UNPAID",
          paidAt: ins.paidAt,
          paidAmount: ins.paid ? ins.amount : null,
          paymentMethod: ins.paid ? "Bank Transfer" : null,
        },
      });
    }
    return contract;
  }

  // Contract 1 — Omar bought A-102 (720,000 SAR)
  // Installment 4 is OVERDUE → shows in pendingPayments KPI
  const unitA102 = u("A-102");
  if (omar && unitA102) {
    await makeContract(omar, unitA102.id, "CNT-2026-001", 720000, pastDate(2026, 1, 15), [
      { num: 1, amount: 180000, due: pastDate(2026, 1, 15), paid: true, paidAt: pastDate(2026, 1, 15) },
      { num: 2, amount: 180000, due: pastDate(2026, 2, 15), paid: true, paidAt: pastDate(2026, 2, 17) },
      { num: 3, amount: 180000, due: pastDate(2026, 3, 15), paid: true, paidAt: pastDate(2026, 3, 14) },
      { num: 4, amount: 180000, due: pastDate(2026, 4, 15), paid: false, paidAt: null, overdue: true },
    ]);
  }

  // Contract 2 — Hessa bought A-101 (850,000 SAR)
  // Installment 3 paid this month → contributes to monthlyRevenue
  const unitA101 = u("A-101");
  if (hessa && unitA101) {
    await prisma.unit.update({ where: { id: unitA101.id }, data: { status: "SOLD" } });
    await makeContract(hessa, unitA101.id, "CNT-2026-002", 850000, pastDate(2026, 2, 1), [
      { num: 1, amount: 285000, due: pastDate(2026, 2, 1),  paid: true, paidAt: pastDate(2026, 2, 1) },
      { num: 2, amount: 285000, due: pastDate(2026, 3, 1),  paid: true, paidAt: pastDate(2026, 3, 3) },
      { num: 3, amount: 280000, due: thisMonth(10), paid: true, paidAt: thisMonth(10) }, // this month
    ]);
  }

  // Contract 3 — Sara bought C2-02 (1,800,000 SAR)
  // Installment 2 paid this month → contributes to monthlyRevenue
  const noura = findC("Noura Al-Dosari");
  const sara  = findC("Sara Al-Mutairi");
  const unitC202 = u("C2-02");
  if (sara && unitC202) {
    await makeContract(sara, unitC202.id, "CNT-2026-003", 1800000, pastDate(2026, 3, 10), [
      { num: 1, amount: 360000, due: pastDate(2026, 3, 10), paid: true,  paidAt: pastDate(2026, 3, 10) },
      { num: 2, amount: 360000, due: thisMonth(15),         paid: true,  paidAt: thisMonth(15) }, // this month
      { num: 3, amount: 360000, due: new Date("2026-05-10"), paid: false, paidAt: null },
      { num: 4, amount: 360000, due: new Date("2026-06-10"), paid: false, paidAt: null },
      { num: 5, amount: 360000, due: new Date("2026-07-10"), paid: false, paidAt: null },
    ]);
  }

  // Contract 4 — Noura bought C2-01 (900,000 SAR)
  // Installment 2 paid this month → contributes to monthlyRevenue
  const unitC201 = u("C2-01");
  if (noura && unitC201) {
    await prisma.unit.update({ where: { id: unitC201.id }, data: { status: "SOLD" } });
    await makeContract(noura, unitC201.id, "CNT-2026-004", 900000, pastDate(2026, 3, 20), [
      { num: 1, amount: 450000, due: pastDate(2026, 3, 20), paid: true, paidAt: pastDate(2026, 3, 20) },
      { num: 2, amount: 450000, due: thisMonth(5),          paid: true, paidAt: thisMonth(5) }, // this month
    ]);
  }

  // Draft contract (does NOT count toward signedContracts KPI)
  if (mohammed && unitA201) {
    await prisma.contract.create({
      data: {
        customerId: mohammed.id,
        unitId: unitA201.id,
        userId: adminUser?.id,
        status: "DRAFT",
        type: "SALE",
        contractNumber: "CNT-2026-005",
        amount: 980000,
      },
    });
  }

  console.log("Created 4 signed contracts + 1 draft, with payment plans");

  // ── Extra Maintenance Requests ───────────────────────────────────────────
  const extraUnits = units.filter((x) =>
    ["B-101", "B-201", "C1-01", "C1-03", "C2-01"].includes(x.number),
  );
  const maintenance = [
    { title: "تلف في نوافذ الطابق الثاني",   type: "carpentry",  status: "OPEN",        priority: "LOW" },
    { title: "انسداد في الصرف الصحي",         type: "plumbing",   status: "IN_PROGRESS", priority: "HIGH" },
    { title: "دهان وترميم الجدران",           type: "painting",   status: "OPEN",        priority: "LOW" },
    { title: "خلل في نظام الإنذار",           type: "electrical", status: "IN_PROGRESS", priority: "URGENT" },
    { title: "صيانة مكيف مركزي",              type: "hvac",       status: "RESOLVED",    priority: "MEDIUM" },
  ];
  for (let i = 0; i < maintenance.length; i++) {
    const unit = extraUnits[i];
    if (!unit) continue;
    const m = maintenance[i]!;
    await prisma.maintenanceRequest.create({
      data: {
        title: m.title,
        type: m.type,
        status: m.status as any,
        priority: m.priority as any,
        unitId: unit.id,
        organizationId: org.id,
        ...(m.status === "RESOLVED" ? { resolvedAt: pastDate(2026, 4, 10) } : {}),
      },
    });
  }
  console.log("Created 5 extra maintenance requests");

  // ── Summary ──────────────────────────────────────────────────────────────
  const revenue =
    280000 + // Hessa installment 3
    360000 + // Sara installment 2
    450000;  // Noura installment 2

  console.log("\n✅  Demo seed complete!");
  console.log("   Expected dashboard KPIs:");
  console.log(`   • Monthly Revenue      ≈ ${(revenue).toLocaleString()} SAR`);
  console.log("   • Active Deals         = 3  (reservations)");
  console.log("   • Signed Contracts     = 4");
  console.log("   • Pending Payments     = 1  (overdue installment on CNT-2026-001)");
  console.log("   • Open Maintenance     = 6  (OPEN + IN_PROGRESS)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
