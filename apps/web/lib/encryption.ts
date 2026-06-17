import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";

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

/**
 * Keyed HMAC-SHA256 blind index for exact-match search on encrypted fields.
 * Output is prefixed with "v1:" to allow future key rotation.
 * Fails closed if PII_HASH_PEPPER is unset.
 */
export function hashForSearch(value: string): string {
  return "v1:" + createHmac("sha256", getPepper()).update(value.trim().toLowerCase()).digest("hex");
}
