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
 * Graceful fallback: if value doesn't match encrypted format, returns as-is.
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue || !encryptedValue.includes(":")) {
    return encryptedValue; // Not encrypted, return as-is
  }

  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    return encryptedValue; // Not our format, return as-is
  }

  try {
    const key = getKey();
    const iv = Buffer.from(parts[0]!, "base64");
    const authTag = Buffer.from(parts[1]!, "base64");
    const ciphertext = parts[2]!;

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedValue; // Decryption failed, return as-is (pre-migration data)
  }
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
