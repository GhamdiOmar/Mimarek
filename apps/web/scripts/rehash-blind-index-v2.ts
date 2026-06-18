/**
 * Blind-index re-hash: v1 (global pepper) → v2 (per-tenant), in place (H8).
 *
 * For every Customer, decrypt the stored PII columns and recompute the
 * nationalIdHash / phoneHash / emailHash with the PER-TENANT v2 key
 * (`hashForSearch(value, organizationId)`), overwriting the existing `*Hash`
 * columns. NO schema change — the "v2:" prefix self-identifies the version.
 *
 * Safety:
 *  - Idempotent: a customer whose every present hash already starts with "v2:"
 *    is skipped (safe to re-run).
 *  - Non-destructive to the underlying PII: only the derived *Hash columns are
 *    rewritten; the encrypted value columns are untouched.
 *  - Dual-read in the app (searchHashCandidates probes v2 + v1) means search keeps
 *    working for any row this backfill hasn't reached yet — partial runs never
 *    strand a customer.
 *  - Decrypt/hash failures are logged and counted, never silently dropped.
 *
 * Run a backup of the three hash columns FIRST (see the v4.33 manual-steps runbook).
 *
 * Usage:
 *   npx tsx scripts/rehash-blind-index-v2.ts [--dry]
 *
 * Prerequisites (process env): DATABASE_URL, PII_ENCRYPTION_KEY, PII_HASH_PEPPER.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { decrypt, hashForSearch } from "../lib/encryption";
import { normalizeSaudiPhoneE164 } from "../lib/phone";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
if (!process.env.PII_ENCRYPTION_KEY) throw new Error("PII_ENCRYPTION_KEY is required");
if (!process.env.PII_HASH_PEPPER) throw new Error("PII_HASH_PEPPER is required");

const pool = new pg.Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Per-tenant phone blind index — mirrors pii-crypto.phoneSearchHash exactly. */
function phoneHashV2(phonePlain: string, orgId: string): string {
  return hashForSearch(normalizeSaudiPhoneE164(phonePlain) ?? phonePlain, orgId);
}

const isV2 = (h: string | null) => h == null || h.startsWith("v2:");

async function main() {
  const dryRun = process.argv.includes("--dry");
  console.log(`\n🔑 Blind-index re-hash v1 → v2 (per-tenant)${dryRun ? " — DRY RUN" : ""}\n`);

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      organizationId: true,
      phone: true,
      email: true,
      nationalId: true,
      phoneHash: true,
      emailHash: true,
      nationalIdHash: true,
    },
  });

  let scanned = 0;
  let rehashed = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of customers) {
    scanned++;

    // Idempotency: already fully v2 → nothing to do.
    if (isV2(c.phoneHash) && isV2(c.emailHash) && isV2(c.nationalIdHash)) {
      skipped++;
      continue;
    }

    const data: { phoneHash?: string; emailHash?: string; nationalIdHash?: string } = {};
    try {
      if (c.phone) data.phoneHash = phoneHashV2(decrypt(c.phone), c.organizationId);
      if (c.email) data.emailHash = hashForSearch(decrypt(c.email), c.organizationId);
      if (c.nationalId) data.nationalIdHash = hashForSearch(decrypt(c.nationalId), c.organizationId);
    } catch (e) {
      failed++;
      console.error(`  ⚠️  customer ${c.id}: decrypt/hash failed — ${(e as Error).message}`);
      continue;
    }

    if (Object.keys(data).length === 0) {
      skipped++;
      continue;
    }

    if (!dryRun) {
      await prisma.customer.update({ where: { id: c.id }, data });
    }
    rehashed++;
  }

  console.log(
    `\n  scanned=${scanned}  rehashed=${rehashed}  skipped=${skipped}  failed=${failed}${dryRun ? "  (no writes)" : ""}`,
  );

  // Post-check: how many v1-prefixed hashes remain (should be 0 after a full run).
  const v1Remaining = await prisma.customer.count({
    where: {
      OR: [
        { phoneHash: { startsWith: "v1:" } },
        { emailHash: { startsWith: "v1:" } },
        { nationalIdHash: { startsWith: "v1:" } },
      ],
    },
  });
  console.log(`  v1-prefixed hashes remaining: ${v1Remaining}\n`);

  await prisma.$disconnect();
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("❌ Re-hash script failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
