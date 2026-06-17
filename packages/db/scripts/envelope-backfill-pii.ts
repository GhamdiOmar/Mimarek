/**
 * A1 ciphertext-envelope backfill: bring every Customer PII field (and
 * Organization.managerInfo.managerId) onto the `v1:` envelope so the live DB
 * CHECK constraint (packages/db/sql/2026-07-ciphertext-envelope.sql) can be added.
 *
 * Per field, classify the stored value:
 *   - "versioned" (already v1:iv:tag:ct)            → SKIP (idempotent).
 *   - "legacy"    (bare iv:tag:ct that DECRYPTS)    → prepend "v1:" only. Ciphertext
 *                                                     bytes unchanged, hash UNCHANGED.
 *   - "plaintext" (or a 3-part value that FAILS to  → encrypt() fresh AND recompute
 *                  decrypt — i.e. coincidental)        the matching *Hash blind index.
 *
 * The crypto here is duplicated INLINE (the script can't import apps/web). It MUST
 * mirror apps/web/lib/encryption.ts exactly:
 *   - encrypt() emits  v1:iv:authTag:ciphertext
 *   - hashForSearch()  = "v1:" + HMAC_SHA256(PII_HASH_PEPPER, value.trim().toLowerCase())
 *   - phoneSearchHash  = hashForSearch over the E.164-normalized phone
 * (mirrors apps/web/lib/pii-crypto.ts phoneSearchHash + lib/phone.ts).
 *
 * Usage:
 *   PII_ENCRYPTION_KEY=<hex> PII_HASH_PEPPER=<hex> DATABASE_URL=<...> \
 *     npx tsx packages/db/scripts/envelope-backfill-pii.ts [--dry-run]
 *
 *   --dry-run : write NOTHING; tally + print, per field, the counts of
 *               {versioned, legacy, plaintext} and how many WOULD be prefixed
 *               vs freshly-encrypted.
 *
 * WARNING: add the live CHECK constraint (packages/db/sql/2026-07-ciphertext-envelope.sql)
 * ONLY after this script completes a clean (non-dry) run and the verification query
 * in that SQL file returns 0. Adding the constraint before the backfill WILL fail.
 */
import "dotenv/config";
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 100;

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "v1:";

function getKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key) throw new Error("PII_ENCRYPTION_KEY is required");
  return Buffer.from(key, "hex");
}

function getPepper(): string {
  const pepper = process.env.PII_HASH_PEPPER;
  if (!pepper) throw new Error("PII_HASH_PEPPER is required");
  return pepper;
}

/** Mirrors apps/web/lib/encryption.ts encrypt() — emits v1:iv:tag:ct. */
function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${VERSION_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/** Mirrors apps/web/lib/encryption.ts classifyCiphertext(). */
function classifyCiphertext(value: string): "versioned" | "legacy" | "plaintext" {
  if (!value) return "plaintext";
  if (value.startsWith(VERSION_PREFIX)) {
    return value.slice(VERSION_PREFIX.length).split(":").length === 3 ? "versioned" : "plaintext";
  }
  return value.includes(":") && value.split(":").length === 3 ? "legacy" : "plaintext";
}

/**
 * Verify a value actually decrypts with the current key (mirrors encryption.ts
 * decrypt() AES-GCM path). Used to distinguish TRUE legacy ciphertext from a
 * coincidental 3-part plaintext (e.g. "a:b:c") that classifies as legacy but is
 * not real ciphertext. Returns true only on a clean decrypt.
 */
function decryptsCleanly(value: string): boolean {
  try {
    const kind = classifyCiphertext(value);
    if (kind === "plaintext") return false;
    const body = kind === "versioned" ? value.slice(VERSION_PREFIX.length) : value;
    const parts = body.split(":");
    const key = getKey();
    const iv = Buffer.from(parts[0]!, "base64");
    const authTag = Buffer.from(parts[1]!, "base64");
    const ciphertext = parts[2]!;
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    let out = decipher.update(ciphertext, "base64", "utf8");
    out += decipher.final("utf8"); // throws on auth-tag failure
    return true;
  } catch {
    return false;
  }
}

/** Mirrors apps/web/lib/encryption.ts hashForSearch() EXACTLY. */
function hashForSearch(value: string): string {
  return "v1:" + createHmac("sha256", getPepper()).update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Mirrors apps/web/lib/phone.ts normalizeSaudiPhoneE164() EXACTLY. Returns the
 * canonical +9665XXXXXXXX form, or null for anything that is not a valid Saudi
 * mobile (incl. masked PII and ciphertext, which contain "*"/":"). Phone search
 * hashes are computed over THIS normalized form on both write and search sides.
 */
function normalizeSaudiPhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.includes("*") || raw.includes(":")) return null;
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(s)) return null;
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("966")) s = s.slice(3);
  else if (s.startsWith("0")) s = s.slice(1);
  if (!/^5\d{8}$/.test(s)) return null;
  return `+966${s}`;
}

/**
 * Mirrors apps/web/lib/pii-crypto.ts phoneSearchHash(): HMAC over the
 * E.164-normalized form when the value is a valid Saudi mobile, else the raw value.
 */
function phoneSearchHash(phone: string): string {
  return hashForSearch(normalizeSaudiPhoneE164(phone) ?? phone);
}

type FieldPlan = "skip" | "prefix" | "encrypt";

interface FieldTally {
  versioned: number;
  legacy: number;
  plaintext: number;
  willPrefix: number;
  willEncrypt: number;
}

function newTally(): FieldTally {
  return { versioned: 0, legacy: 0, plaintext: 0, willPrefix: 0, willEncrypt: 0 };
}

/**
 * Decide the action for one field value and record it in the tally.
 * Returns the plan so the caller can build the update.
 */
function planField(value: string, tally: FieldTally): FieldPlan {
  const kind = classifyCiphertext(value);
  if (kind === "versioned") {
    tally.versioned++;
    return "skip";
  }
  if (kind === "legacy" && decryptsCleanly(value)) {
    // True legacy ciphertext → prepend marker only; bytes + hash unchanged.
    tally.legacy++;
    tally.willPrefix++;
    return "prefix";
  }
  // plaintext, OR a 3-part value that does NOT decrypt (coincidental) → encrypt fresh.
  tally.plaintext++;
  tally.willEncrypt++;
  return "encrypt";
}

function printTally(label: string, t: FieldTally, withHash: boolean): void {
  console.log(
    `  ${label.padEnd(12)} versioned=${t.versioned}  legacy=${t.legacy}  plaintext=${t.plaintext}  ` +
      `→ wouldPrefix=${t.willPrefix}  wouldEncrypt=${t.willEncrypt}${withHash ? "" : "  (no hash column)"}`,
  );
}

async function main() {
  console.log(`Starting A1 ciphertext-envelope backfill${DRY_RUN ? " (DRY RUN — no writes)" : ""}...`);

  // -------- Customers --------
  const customers = await db.customer.findMany({
    select: { id: true, nationalId: true, phone: true, email: true },
  });
  console.log(`Found ${customers.length} customers to process`);

  const nat = newTally();
  const ph = newTally();
  const em = newTally();
  let customersUpdated = 0;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    const updates: any[] = [];

    for (const c of batch) {
      const data: any = {};
      let needsUpdate = false;

      if (c.nationalId) {
        const plan = planField(c.nationalId, nat);
        if (plan === "prefix") {
          data.nationalId = VERSION_PREFIX + c.nationalId; // hash unchanged
          needsUpdate = true;
        } else if (plan === "encrypt") {
          data.nationalId = encrypt(c.nationalId);
          data.nationalIdHash = hashForSearch(c.nationalId);
          needsUpdate = true;
        }
      }

      if (c.phone) {
        const plan = planField(c.phone, ph);
        if (plan === "prefix") {
          data.phone = VERSION_PREFIX + c.phone; // hash unchanged
          needsUpdate = true;
        } else if (plan === "encrypt") {
          // Encrypt the NORMALIZED phone form (mirrors pii-crypto.ts encryptCustomerData),
          // so the stored ciphertext + hash match the canonical write path.
          const p = normalizeSaudiPhoneE164(c.phone) ?? c.phone;
          data.phone = encrypt(p);
          data.phoneHash = phoneSearchHash(p);
          needsUpdate = true;
        }
      }

      if (c.email) {
        const plan = planField(c.email, em);
        if (plan === "prefix") {
          data.email = VERSION_PREFIX + c.email; // hash unchanged
          needsUpdate = true;
        } else if (plan === "encrypt") {
          data.email = encrypt(c.email);
          data.emailHash = hashForSearch(c.email);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        customersUpdated++;
        if (!DRY_RUN) updates.push(db.customer.update({ where: { id: c.id }, data }));
      }
    }

    if (!DRY_RUN && updates.length > 0) {
      await db.$transaction(updates);
    }
    console.log(`Processed ${Math.min(i + BATCH_SIZE, customers.length)}/${customers.length}`);
  }

  console.log("\nCustomer field breakdown:");
  printTally("nationalId", nat, true);
  printTally("phone", ph, true);
  printTally("email", em, true);
  console.log(
    `Customers ${DRY_RUN ? "that WOULD be updated" : "updated"}: ${customersUpdated}`,
  );

  // -------- Organization.managerInfo.managerId (no hash column) --------
  const orgs = await db.organization.findMany({
    select: { id: true, managerInfo: true },
  });

  const mgr = newTally();
  let orgsUpdated = 0;

  for (const org of orgs) {
    const info = org.managerInfo as any;
    const managerId: string | undefined = info?.managerId;
    if (!managerId) continue;

    const plan = planField(managerId, mgr);
    if (plan === "skip") continue;

    const newManagerId = plan === "prefix" ? VERSION_PREFIX + managerId : encrypt(managerId);
    orgsUpdated++;
    if (!DRY_RUN) {
      await db.organization.update({
        where: { id: org.id },
        data: { managerInfo: { ...info, managerId: newManagerId } },
      });
    }
  }

  console.log("\nOrganization.managerInfo.managerId breakdown:");
  printTally("managerId", mgr, false);
  console.log(
    `Organizations ${DRY_RUN ? "that WOULD be updated" : "updated"}: ${orgsUpdated}`,
  );

  // -------- MarketplaceDeedProof.{deedNumberEnc, ownerNationalIdEnc} (PII, no hash) --------
  // Round-tripped via safeDecryptField in apps/web/app/actions/marketplace.ts. No blind-index
  // column exists, so we only classify → skip/prefix/encrypt (NO hash recompute).
  const deedProofs = await db.marketplaceDeedProof.findMany({
    select: { id: true, deedNumberEnc: true, ownerNationalIdEnc: true },
  });
  console.log(`\nFound ${deedProofs.length} MarketplaceDeedProof row(s) to process`);

  const deedNum = newTally();
  const ownerNid = newTally();
  let deedProofsUpdated = 0;

  for (let i = 0; i < deedProofs.length; i += BATCH_SIZE) {
    const batch = deedProofs.slice(i, i + BATCH_SIZE);
    const updates: any[] = [];

    for (const p of batch) {
      const data: any = {};
      let needsUpdate = false;

      if (p.deedNumberEnc) {
        const plan = planField(p.deedNumberEnc, deedNum);
        if (plan === "prefix") {
          data.deedNumberEnc = VERSION_PREFIX + p.deedNumberEnc;
          needsUpdate = true;
        } else if (plan === "encrypt") {
          data.deedNumberEnc = encrypt(p.deedNumberEnc);
          needsUpdate = true;
        }
      }

      if (p.ownerNationalIdEnc) {
        const plan = planField(p.ownerNationalIdEnc, ownerNid);
        if (plan === "prefix") {
          data.ownerNationalIdEnc = VERSION_PREFIX + p.ownerNationalIdEnc;
          needsUpdate = true;
        } else if (plan === "encrypt") {
          data.ownerNationalIdEnc = encrypt(p.ownerNationalIdEnc);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        deedProofsUpdated++;
        if (!DRY_RUN) updates.push(db.marketplaceDeedProof.update({ where: { id: p.id }, data }));
      }
    }

    if (!DRY_RUN && updates.length > 0) {
      await db.$transaction(updates);
    }
    console.log(`Processed ${Math.min(i + BATCH_SIZE, deedProofs.length)}/${deedProofs.length}`);
  }

  console.log("\nMarketplaceDeedProof field breakdown:");
  printTally("deedNumber", deedNum, false);
  printTally("ownerNatId", ownerNid, false);
  console.log(
    `MarketplaceDeedProof rows ${DRY_RUN ? "that WOULD be updated" : "updated"}: ${deedProofsUpdated}`,
  );

  // -------- SystemConfig.smtpPasswordEncrypted (secret, no hash) --------
  // Written via encrypt() in apps/web/app/actions/email-settings.ts. Single column,
  // no blind-index — classify → skip/prefix/encrypt only.
  const configs = await db.systemConfig.findMany({
    select: { id: true, smtpPasswordEncrypted: true },
  });
  console.log(`\nFound ${configs.length} SystemConfig row(s) to process`);

  const smtp = newTally();
  let configsUpdated = 0;

  for (const cfg of configs) {
    if (!cfg.smtpPasswordEncrypted) continue;

    const plan = planField(cfg.smtpPasswordEncrypted, smtp);
    if (plan === "skip") continue;

    const newValue =
      plan === "prefix"
        ? VERSION_PREFIX + cfg.smtpPasswordEncrypted
        : encrypt(cfg.smtpPasswordEncrypted);
    configsUpdated++;
    if (!DRY_RUN) {
      await db.systemConfig.update({
        where: { id: cfg.id },
        data: { smtpPasswordEncrypted: newValue },
      });
    }
  }

  console.log("\nSystemConfig.smtpPasswordEncrypted breakdown:");
  printTally("smtpPw", smtp, false);
  console.log(
    `SystemConfig rows ${DRY_RUN ? "that WOULD be updated" : "updated"}: ${configsUpdated}`,
  );

  if (DRY_RUN) {
    console.log("\nDRY RUN complete — no rows written.");
  } else {
    console.log(
      "\nBackfill complete. Now run the verification query in " +
        "packages/db/sql/2026-07-ciphertext-envelope.sql (must return 0), then apply the CHECK constraints.",
    );
  }

  await db.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.$disconnect();
    await pool.end();
  } catch {
    /* ignore cleanup errors */
  }
  process.exit(1);
});
