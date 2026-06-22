import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Dedicated ZATCA secret-at-rest helper (plan D7). Mirrors lib/encryption.ts's
 * AES-256-GCM + fail-closed semantics, but keyed to **ZATCA_MASTER_KEY** — the EGS
 * private key / CSID / API secrets are a separate trust domain from customer PII
 * (which uses PII_ENCRYPTION_KEY). Ciphertext envelope prefix "z1:".
 *
 * Encrypts every secret column on ZatcaEgsUnit (privateKeyPem, csrPem,
 * compliance/production token+secret, certificateBase64). Those columns MUST be
 * excluded from every client-facing DTO via an explicit Prisma `select` allowlist (D13).
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "z1:";

function getZatcaKey(): Buffer {
  const key = process.env.ZATCA_MASTER_KEY;
  if (!key) {
    throw new Error("ZATCA_MASTER_KEY environment variable is not set");
  }
  return Buffer.from(key, "hex");
}

/** Encrypt a ZATCA secret. Returns `z1:iv:authTag:ciphertext` (iv/tag/ct base64). */
export function encryptZatca(plaintext: string): string {
  const key = getZatcaKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${VERSION_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt a value produced by encryptZatca(). **Fail-CLOSED**: a malformed envelope
 * or a GCM auth-tag failure THROWS — never returns forged or plaintext output
 * (D13 / §5.9). Unlike the PII decrypt(), there is NO legacy-plaintext passthrough:
 * every ZATCA secret is written through encryptZatca, so a non-`z1:` value is a hard error.
 */
export function decryptZatca(encryptedValue: string): string {
  if (!encryptedValue || !encryptedValue.startsWith(VERSION_PREFIX)) {
    throw new Error("[zatca-crypto] not a ZATCA ciphertext (missing z1: envelope)");
  }
  const parts = encryptedValue.slice(VERSION_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("[zatca-crypto] malformed ZATCA ciphertext envelope");
  }
  const key = getZatcaKey();
  const iv = Buffer.from(parts[0]!, "base64");
  const authTag = Buffer.from(parts[1]!, "base64");
  const ciphertext = parts[2]!;
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  try {
    decrypted += decipher.final("utf8");
  } catch (err) {
    console.error("[zatca-crypto] AES-GCM authentication failed — possible tampering or key mismatch.");
    throw err; // never hand back forged/corrupted plaintext
  }
  return decrypted;
}

/** Encrypt only when a value is present; null/empty → null (column stays NULL). */
export function encryptZatcaOptional(value: string | null | undefined): string | null {
  return value == null || value === "" ? null : encryptZatca(value);
}
