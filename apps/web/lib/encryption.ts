import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("PII_ENCRYPTION_KEY environment variable is not set");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all base64)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt a value encrypted with encrypt().
 *
 * Legacy-plaintext convenience (QA-SEC-06):
 *  - If the value has no ":" or does not split into exactly 3 parts it is
 *    clearly NOT our iv:tag:ciphertext format → return as-is (pre-migration
 *    plaintext or unrelated string).
 *  - If the value IS in iv:tag:ciphertext shape and decipher.final() throws
 *    (GCM auth-tag mismatch, tampered ciphertext, or wrong key) we MUST NOT
 *    silently return the ciphertext — that would defeat AES-GCM tamper
 *    detection.  Instead: log a security event (no secrets in the message)
 *    and re-throw so the caller surfaces an error.
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue || !encryptedValue.includes(":")) {
    return encryptedValue; // Not encrypted — legacy plaintext, return as-is
  }

  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    return encryptedValue; // Not our format — return as-is
  }

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
