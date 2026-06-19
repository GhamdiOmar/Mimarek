// v4.28.0 populated-DB precheck (the §4 "plain db push dry-run" equivalent, read-only).
// Confirms the new constraints won't lose data / fail on the LIVE local Supabase DB:
//   1. Money fields: any value that would be rounded (>2 decimals) or overflow (14,2)?
//   2. vatRate: any value that wouldn't fit (6,4)?
//   3. CouponRedemption: any duplicate (couponId, organizationId) that the new @@unique would reject?
//   4. orgid-backfill tables: row counts (how much backfill is needed)?
import { readFileSync } from "node:fs";
import pg from "pg";

function parseEnv(p) {
  const o = {};
  for (const l of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return o;
}
const env = parseEnv("C:/Users/Ghamd/Desktop/Projects/Mimarek/.env.local");
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// (table, column) money fields that get @db.Decimal(14,2)
const MONEY = [
  ["Organization", "capitalAmountSar"],
  ["Unit", "price"], ["Unit", "markupPrice"], ["Unit", "rentalPrice"],
  ["Customer", "budget"],
  ["Reservation", "amount"], ["Reservation", "depositAmount"],
  ["Contract", "amount"], ["Contract", "securityDeposit"],
  ["Contract", "grossAmount"], ["Contract", "discountAmount"], ["Contract", "netAmount"],
  ["PaymentPlan", "totalAmount"], ["PaymentPlan", "downPayment"],
  ["PaymentPlanInstallment", "amount"], ["PaymentPlanInstallment", "paidAmount"],
  ["Lease", "totalAmount"],
  ["RentInstallment", "amount"], ["RentInstallment", "paidAmount"],
  ["MaintenanceRequest", "estimatedCost"], ["MaintenanceRequest", "actualCost"],
  ["Plan", "priceMonthly"], ["Plan", "priceAnnual"],
  ["Subscription", "priceAtRenewal"], ["Subscription", "mrrSar"],
  ["SubscriptionEvent", "mrrDeltaSar"], ["SubscriptionMrrSnapshot", "mrrSar"],
  ["Invoice", "subtotal"], ["Invoice", "vatAmount"], ["Invoice", "discountAmount"], ["Invoice", "total"],
  ["InvoiceLineItem", "unitPrice"], ["InvoiceLineItem", "vatAmount"], ["InvoiceLineItem", "total"],
  ["PaymentTransaction", "amount"], ["PaymentTransaction", "refundedAmount"],
  ["Coupon", "value"], ["Coupon", "minPurchaseAmount"],
  ["CouponRedemption", "discountApplied"],
  ["CustomerPropertyInterest", "value"], // Deal model @@maps to this table
  ["MarketplaceListing", "price"],
];

let problems = 0;
console.log("=== MONEY precision (14,2) — values that would round or overflow ===");
for (const [t, c] of MONEY) {
  try {
    const q = `SELECT count(*)::int AS n FROM "${t}" WHERE "${c}" IS NOT NULL AND ("${c}" <> round("${c}",2) OR abs(trunc("${c}")) >= 1e12)`;
    const { rows } = await pool.query(q);
    if (rows[0].n > 0) { console.log(`  ⚠ ${t}.${c}: ${rows[0].n} row(s) would lose data`); problems += rows[0].n; }
  } catch (e) { console.log(`  ? ${t}.${c}: ${e.message.split("\n")[0]}`); }
}
console.log(problems === 0 ? "  ✓ no money value would be rounded/overflowed" : `  ✗ ${problems} money values at risk`);

console.log("=== vatRate (6,4) ===");
for (const t of ["Invoice", "InvoiceLineItem"]) {
  try {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "${t}" WHERE "vatRate" IS NOT NULL AND ("vatRate" <> round("vatRate",4) OR abs("vatRate") >= 100)`);
    console.log(`  ${t}.vatRate at risk: ${rows[0].n}`);
  } catch (e) { console.log(`  ? ${t}.vatRate: ${e.message.split("\n")[0]}`); }
}

console.log("=== CouponRedemption duplicate (couponId, organizationId) ===");
try {
  const { rows } = await pool.query(`SELECT "couponId","organizationId", count(*)::int n FROM "CouponRedemption" GROUP BY 1,2 HAVING count(*) > 1`);
  console.log(rows.length === 0 ? "  ✓ no duplicates — @@unique is safe" : `  ✗ ${rows.length} duplicate pair(s) — must dedupe first`);
} catch (e) { console.log(`  ? ${e.message.split("\n")[0]}`); }

console.log("=== orgid-backfill table row counts ===");
for (const t of ["Lease", "Reservation", "PaymentPlanInstallment", "Coupon", "CouponRedemption"]) {
  try {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "${t}"`);
    console.log(`  ${t}: ${rows[0].n} rows`);
  } catch (e) { console.log(`  ? ${t}: ${e.message.split("\n")[0]}`); }
}

await pool.end();
console.log("DONE precheck");
