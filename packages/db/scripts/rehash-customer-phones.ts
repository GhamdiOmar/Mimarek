/**
 * Backfill script (v4.18.0, P2-3): recompute every Customer.phoneHash from the
 * E.164-normalized phone, so blind-index search matches regardless of the format
 * the number was entered/stored in ("0551234567" vs "+966551234567").
 *
 * Why this is needed:
 *   • Before v4.18.0, phoneHash was HMAC over the raw (trim/lowercase-only) phone,
 *     so "0551234567" and "+966551234567" hashed differently — exact search
 *     silently missed.
 *   • Some legacy rows may also carry a plain-SHA256 phoneHash from the original
 *     encrypt-existing-pii.ts migration (predates the HMAC switch). Recomputing
 *     with the canonical HMAC reconciles those too.
 *
 * This script:
 *   1. Reads every Customer (id, phone, phoneHash).
 *   2. Decrypts the phone (decrypt() returns plaintext as-is for unencrypted rows).
 *   3. Normalizes to E.164 (Saudi mobile) — falls back to the raw value otherwise.
 *   4. Recomputes phoneHash = HMAC-SHA256 (the canonical lib/encryption.ts form).
 *   5. Updates ONLY rows whose phoneHash actually changed. Idempotent, batched,
 *      logged counts. Does NOT re-encrypt the stored value (read-side normalization
 *      handles display); it only fixes the search index.
 *
 * Usage:
 *   PII_ENCRYPTION_KEY=<hex> PII_HASH_PEPPER=<secret> DATABASE_URL=<url> npx tsx packages/db/scripts/rehash-customer-phones.ts
 */
import "dotenv/config";
import { createDecipheriv, createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;

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

// NOTE: superseded by packages/db/scripts/envelope-backfill-pii.ts (A1 v1: envelope). Kept v1:-aware for safety.
// Mirrors apps/web/lib/encryption.ts decrypt(): returns the value unchanged if it
// is not in our 3-part iv:authTag:ciphertext format (graceful pre-migration path).
// v1:-aware: a versioned value (v1:iv:tag:ct) has the prefix stripped before splitting,
// so it decrypts correctly instead of being returned as ciphertext.
function decrypt(value: string): string {
  if (!value || !value.includes(":")) return value;
  const body = value.startsWith("v1:") ? value.slice("v1:".length) : value;
  const parts = body.split(":");
  if (parts.length !== 3) return value;
  try {
    const iv = Buffer.from(parts[0]!, "base64");
    const authTag = Buffer.from(parts[1]!, "base64");
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(parts[2]!, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return value;
  }
}

// MUST match apps/web/lib/encryption.ts hashForSearch EXACTLY.
function hashForSearch(value: string): string {
  return "v1:" + createHmac("sha256", getPepper()).update(value.trim().toLowerCase()).digest("hex");
}

// Inlined from apps/web/lib/phone.ts — SOURCE OF TRUTH lives there; keep in sync.
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

function phoneSearchHash(phone: string): string {
  return hashForSearch(normalizeSaudiPhoneE164(phone) ?? phone);
}

const BATCH_SIZE = 100;

async function main() {
  console.log("Starting rehash-customer-phones backfill…");

  const customers = await db.customer.findMany({
    select: { id: true, phone: true, phoneHash: true },
  });
  console.log(`Found ${customers.length} customer(s) to inspect.`);

  let updated = 0;
  let unchanged = 0;
  let empty = 0;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);

    const updates = batch
      .map((c) => {
        const plain = decrypt(c.phone);
        if (!plain || plain.trim() === "") {
          // No phone (e.g. cleared marketplace sentinel): hash must be null.
          if (c.phoneHash === null) {
            empty++;
            return null;
          }
          empty++;
          return db.customer.update({ where: { id: c.id }, data: { phoneHash: null } });
        }
        const newHash = phoneSearchHash(plain);
        if (newHash === c.phoneHash) {
          unchanged++;
          return null;
        }
        updated++;
        return db.customer.update({ where: { id: c.id }, data: { phoneHash: newHash } });
      })
      .filter(Boolean);

    if (updates.length > 0) {
      await db.$transaction(updates as Parameters<typeof db.$transaction>[0]);
    }

    console.log(
      `Processed ${Math.min(i + BATCH_SIZE, customers.length)}/${customers.length} ` +
        `(updated: ${updated}, unchanged: ${unchanged}, empty: ${empty})`,
    );
  }

  console.log(`\nDone. updated=${updated} unchanged=${unchanged} empty=${empty}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
