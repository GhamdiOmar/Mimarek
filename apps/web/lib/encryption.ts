import { createCipheriv, createDecipheriv, randomBytes, createHmac, hkdfSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Ciphertext envelope version marker (A1). Every value produced by encrypt() is
 * prefixed with this so the DB layer can enforce a CHECK constraint and the read
 * path can distinguish versioned ciphertext from legacy ciphertext and plaintext.
 * Base64 never contains ":", so the prefix + colon-delimited body stays unambiguous.
 */
const VERSION_PREFIX = "v1:";

function getKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("PII_ENCRYPTION_KEY environment variable is not set");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns format: v1:iv:authTag:ciphertext (the iv/tag/ct parts all base64).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Classify a stored field value by its ciphertext envelope (A1):
 *  - "versioned": carries the v1: prefix and a well-formed 3-part body → current format.
 *  - "legacy":    no prefix but a bare iv:tag:ct 3-part body → pre-A1 ciphertext.
 *  - "plaintext": anything else (empty, no colon, or wrong part count, including a
 *                 v1: prefix with a malformed body) → NOT our ciphertext.
 * Pure function: no key/pepper access, safe to call on the read hot-path.
 */
export function classifyCiphertext(value: string): "versioned" | "legacy" | "plaintext" {
  if (!value) return "plaintext";
  if (value.startsWith(VERSION_PREFIX)) {
    return value.slice(VERSION_PREFIX.length).split(":").length === 3 ? "versioned" : "plaintext";
  }
  return value.includes(":") && value.split(":").length === 3 ? "legacy" : "plaintext";
}

/**
 * Decrypt a value encrypted with encrypt().
 *
 * Envelope-aware (A1) + legacy-plaintext convenience (QA-SEC-06):
 *  - "plaintext" per classifyCiphertext() → return as-is (pre-migration plaintext
 *    or an unrelated string; unchanged passthrough behaviour).
 *  - "versioned" → strip the v1: prefix, then decrypt the iv:tag:ct body.
 *  - "legacy"    → decrypt the bare iv:tag:ct body directly.
 *  Both ciphertext classes flow through the SAME AES-256-GCM path below — only the
 *  prefix-strip differs. If decipher.final() throws (GCM auth-tag mismatch, tampered
 *  ciphertext, or wrong key) we MUST NOT silently return the ciphertext — that would
 *  defeat AES-GCM tamper detection. Instead: log a security event (no secrets) and
 *  re-throw so the caller surfaces an error.
 */
export function decrypt(encryptedValue: string): string {
  const kind = classifyCiphertext(encryptedValue);
  if (kind === "plaintext") {
    return encryptedValue; // Not our ciphertext — legacy plaintext, return as-is
  }

  // Strip the v1: prefix for versioned values; legacy values have no prefix.
  const body = kind === "versioned" ? encryptedValue.slice(VERSION_PREFIX.length) : encryptedValue;
  const parts = body.split(":");

  // Value matches iv:tag:ciphertext shape — treat as encrypted.
  // Any decryption failure here is security-relevant (tampering / key mismatch).
  const key = getKey();
  const iv = Buffer.from(parts[0]!, "base64");
  const authTag = Buffer.from(parts[1]!, "base64");
  const ciphertext = parts[2]!;

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  // decipher.final() throws on GCM auth-tag failure — do NOT swallow it.
  try {
    decrypted += decipher.final("utf8");
  } catch (err) {
    console.error(
      "[encryption] AES-GCM authentication failed — possible data tampering or key mismatch.",
    );
    throw err; // Re-throw: callers must not receive a forged/corrupted plaintext.
  }
  return decrypted;
}

function getPepper(): string {
  const pepper = process.env.PII_HASH_PEPPER;
  if (!pepper) {
    throw new Error("PII_HASH_PEPPER environment variable is not set");
  }
  return pepper;
}

/** Canonical blind-index normalization — applied identically on write and search. */
function normalizeForHash(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Per-tenant blind-index subkey (H8). Derived from the master pepper via
 * HKDF-SHA256 (RFC 5869) with a per-org domain-separation `info` label — so two
 * organizations produce DIFFERENT keys (hence different hashes) for the SAME
 * value. This makes the stored blind indexes cross-tenant UNLINKABLE: an attacker
 * with read access to the hash columns (but not the pepper) cannot correlate that
 * the same phone/email exists across orgs, and cannot brute-force without the
 * pepper. No per-org secret is stored — the key is a deterministic function of
 * pepper + orgId. (A full pepper compromise still derives every key; storing
 * independent per-org keys in a KMS is the deferred DB-governance program's scope.)
 */
function tenantBlindKey(orgId: string): Buffer {
  // HKDF extract+expand: ikm=pepper, salt empty, info = domain-separated per-org label, 32-byte key.
  return Buffer.from(hkdfSync("sha256", getPepper(), "", "mimaric/blind-index/v2/" + orgId, 32));
}

/**
 * Per-tenant keyed HMAC-SHA256 blind index for exact-match search on encrypted
 * fields (v2). Prefixed "v2:". The search path MUST hash the query with the same
 * orgId, and — during the v1→v2 migration window — also probe the legacy hash via
 * `legacyHashForSearch` (dual-read), see pii-crypto's *Candidates helpers.
 * Fails closed if PII_HASH_PEPPER is unset.
 */
export function hashForSearch(value: string, orgId: string): string {
  return (
    "v2:" +
    createHmac("sha256", tenantBlindKey(orgId)).update(normalizeForHash(value)).digest("hex")
  );
}

/**
 * Legacy global-pepper blind index (v1). Retained ONLY for the dual-read window
 * during the per-tenant (v2) migration and for the one-time re-hash backfill
 * (`scripts/rehash-blind-index-v2.ts`). New writes use the per-tenant
 * `hashForSearch(value, orgId)`. Remove once every long-lived environment is
 * fully backfilled to v2 and no v1-prefixed hash remains.
 */
export function legacyHashForSearch(value: string): string {
  return "v1:" + createHmac("sha256", getPepper()).update(normalizeForHash(value)).digest("hex");
}
