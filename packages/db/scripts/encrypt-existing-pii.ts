/**
 * One-time migration script: encrypt existing plaintext PII in Customer table.
 *
 * Usage:
 *   PII_ENCRYPTION_KEY=<hex> npx tsx packages/db/scripts/encrypt-existing-pii.ts
 */
import "dotenv/config";
import { createCipheriv, randomBytes, createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

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

function hashForSearch(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// NOTE: superseded by packages/db/scripts/envelope-backfill-pii.ts (A1 v1: envelope). Kept v1:-aware for safety.
// v1:-aware: treats BOTH a 3-part bare value AND a 4-part v1:-prefixed value as already-encrypted,
// so a re-run after the envelope backfill cannot double-encrypt versioned ciphertext.
function isAlreadyEncrypted(value: string): boolean {
  if (!value || !value.includes(":")) return false;
  return value.startsWith("v1:") || value.split(":").length === 3;
}

async function main() {
  console.log("Starting PII encryption migration...");

  const customers = await db.customer.findMany({
    select: { id: true, nationalId: true, phone: true, email: true },
  });

  console.log(`Found ${customers.length} customers to process`);

  const BATCH_SIZE = 100;
  let encrypted = 0;
  let skipped = 0;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    const updates = batch.map((c) => {
      const data: any = {};
      let needsUpdate = false;

      if (c.nationalId && !isAlreadyEncrypted(c.nationalId)) {
        data.nationalId = encrypt(c.nationalId);
        data.nationalIdHash = hashForSearch(c.nationalId);
        needsUpdate = true;
      }
      if (c.phone && !isAlreadyEncrypted(c.phone)) {
        data.phone = encrypt(c.phone);
        data.phoneHash = hashForSearch(c.phone);
        needsUpdate = true;
      }
      if (c.email && !isAlreadyEncrypted(c.email)) {
        data.email = encrypt(c.email);
        data.emailHash = hashForSearch(c.email);
        needsUpdate = true;
      }

      if (needsUpdate) {
        encrypted++;
        return db.customer.update({ where: { id: c.id }, data });
      }
      skipped++;
      return null;
    }).filter(Boolean);

    if (updates.length > 0) {
      await db.$transaction(updates as any);
    }

    console.log(`Processed ${Math.min(i + BATCH_SIZE, customers.length)}/${customers.length} (${encrypted} encrypted, ${skipped} skipped)`);
  }

  console.log(`\nDone! Encrypted ${encrypted} customers, skipped ${skipped} (already encrypted)`);

  // Also encrypt Organization.managerInfo.managerId
  const orgs = await db.organization.findMany({
    select: { id: true, managerInfo: true },
  });

  let orgEncrypted = 0;
  for (const org of orgs) {
    const info = org.managerInfo as any;
    if (info?.managerId && !isAlreadyEncrypted(info.managerId)) {
      await db.organization.update({
        where: { id: org.id },
        data: {
          managerInfo: { ...info, managerId: encrypt(info.managerId) },
        },
      });
      orgEncrypted++;
    }
  }

  console.log(`Encrypted ${orgEncrypted} organization manager IDs`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
