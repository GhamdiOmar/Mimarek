/**
 * Repair script: encrypt plaintext / sentinel phone values on Customer rows
 * created via the marketplace inquiry flow (source = "MARKETPLACE") before
 * the P1-1 fix landed in v4.18.0.
 *
 * The pre-fix path wrote either:
 *   • a raw Saudi phone string (e.g. "0501234567") — plaintext PII, no hash
 *   • the literal "—"                              — sentinel indicating no phone was given
 *
 * This script:
 *   1. Selects all customers with source = "MARKETPLACE".
 *   2. Skips rows whose phone is already in the 3-part `iv:authTag:ciphertext`
 *      format (idempotent — safe to re-run).
 *   3. For rows with a real phone ("—" is NOT a real phone):
 *      • Normalizes to E.164 (+9665XXXXXXXX) using the same logic as
 *        apps/web/lib/phone.ts (inlined below — the db package cannot import
 *        from apps/web; keep this in sync with the source of truth there).
 *      • Encrypts with AES-256-GCM and writes phoneHash (blind index).
 *   4. For rows with "—" or any value that cannot be normalized:
 *      • Sets phone = "" (empty string).
 *      • Leaves phoneHash = null.
 *      • Rationale: the Customer schema has `phone String` (required, non-null)
 *        so we cannot set null. An empty string is the conventional "no phone"
 *        sentinel in this codebase — maskPhone("") returns "", normalizeSaudiPhoneE164("")
 *        returns null, and the UI omits Call/WhatsApp affordances for empty phone.
 *        This is preferable to re-encrypting "—" as ciphertext, which would make
 *        it indistinguishable from a real (but bad) phone.
 *
 * Usage:
 *   PII_ENCRYPTION_KEY=<hex> PII_HASH_PEPPER=<secret> DATABASE_URL=<url> npx tsx packages/db/scripts/repair-marketplace-customer-pii.ts
 */
import "dotenv/config";
import { createCipheriv, randomBytes, createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// ─── DB client (mirrors encrypt-existing-pii.ts bootstrap) ────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ─── Crypto helpers (mirrors encrypt-existing-pii.ts) ─────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key) throw new Error("PII_ENCRYPTION_KEY is required");
  return Buffer.from(key, "hex");
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

function getPepper(): string {
  const pepper = process.env.PII_HASH_PEPPER;
  if (!pepper) throw new Error("PII_HASH_PEPPER is required");
  return pepper;
}

// MUST match apps/web/lib/encryption.ts hashForSearch EXACTLY: keyed HMAC-SHA256
// with a "v1:" prefix. The live search path uses this; a plain SHA-256 hash here
// would write values that never match a search query (the P2-3 audit correction).
function hashForSearch(value: string): string {
  return "v1:" + createHmac("sha256", getPepper()).update(value.trim().toLowerCase()).digest("hex");
}

function isAlreadyEncrypted(value: string): boolean {
  if (!value || !value.includes(":")) return false;
  return value.split(":").length === 3;
}

// ─── Phone normalization (inlined from apps/web/lib/phone.ts) ─────────────────
// SOURCE OF TRUTH: apps/web/lib/phone.ts — keep in sync with that file.
// The db package cannot import from apps/web, so we inline the minimal logic.

function normalizeSaudiPhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Masked PII or encrypted ciphertext must never be treated as a phone.
  if (raw.includes("*") || raw.includes(":")) return null;
  // Strip formatting characters humans type. A leading + is meaningful; keep it.
  let s = raw.trim().replace(/[\s\-().]/g, "");
  // Reject if anything other than digits and a single leading + remains.
  if (!/^\+?\d+$/.test(s)) return null;
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2); // international 00 prefix
  if (s.startsWith("966")) s = s.slice(3); // country code
  else if (s.startsWith("0")) s = s.slice(1); // national trunk 0
  // National significant number for a Saudi mobile: 5 followed by 8 digits.
  if (!/^5\d{8}$/.test(s)) return null;
  return `+966${s}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;

async function main() {
  console.log("Starting repair-marketplace-customer-pii migration…");

  const customers = await db.customer.findMany({
    where: { source: "MARKETPLACE" },
    select: { id: true, phone: true, phoneHash: true },
  });

  console.log(`Found ${customers.length} MARKETPLACE customer(s) to inspect.`);

  let encrypted = 0;
  let cleared = 0;
  let skipped = 0;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);

    const updates = batch
      .map((c) => {
        // Skip rows already in ciphertext format — idempotent.
        if (isAlreadyEncrypted(c.phone)) {
          skipped++;
          return null;
        }

        const normalized = normalizeSaudiPhoneE164(c.phone);

        if (normalized) {
          // Real phone: encrypt it and populate the blind-index hash.
          encrypted++;
          return db.customer.update({
            where: { id: c.id },
            data: {
              phone: encrypt(normalized),
              phoneHash: hashForSearch(normalized),
            },
          });
        } else {
          // "—", empty string, or an unnormalizable value:
          // Set phone = "" (the "no phone" sentinel — maskPhone("") returns "",
          // normalizeSaudiPhoneE164("") returns null, UI omits call/WhatsApp links).
          // phoneHash left null — cannot search on a missing phone.
          cleared++;
          return db.customer.update({
            where: { id: c.id },
            data: {
              phone: "",
              phoneHash: null,
            },
          });
        }
      })
      .filter(Boolean);

    if (updates.length > 0) {
      await db.$transaction(updates as Parameters<typeof db.$transaction>[0]);
    }

    console.log(
      `Processed ${Math.min(i + BATCH_SIZE, customers.length)}/${customers.length} ` +
        `(encrypted: ${encrypted}, cleared: ${cleared}, skipped: ${skipped})`,
    );
  }

  console.log(
    `\nDone. encrypted=${encrypted} cleared=${cleared} skipped-already-ok=${skipped}`,
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
