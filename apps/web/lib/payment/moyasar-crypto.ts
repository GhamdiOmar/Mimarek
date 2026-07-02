import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Dedicated payment-gateway secret-at-rest helper. Mirrors lib/zatca-crypto.ts's
 * AES-256-GCM + fail-closed semantics, but keyed to **MOYASAR_MASTER_KEY** — the
 * gateway API key / webhook secret are a separate trust domain from ZATCA EGS
 * secrets (ZATCA_MASTER_KEY) and from customer PII (PII_ENCRYPTION_KEY).
 * Ciphertext envelope prefix "m1:".
 *
 * Encrypts the GatewayConfig secret columns (apiKeyEncrypted,
 * webhookSecretEncrypted, publishableKeyEncrypted). Those columns MUST be
 * excluded from every client-facing DTO via GATEWAY_PUBLIC_SELECT.
 *
 * The master key itself CANNOT live in the DB (it decrypts the DB secrets — an
 * infinite regress); it stays an env var, set on the deployed host.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "m1:";

function getMoyasarKey(): Buffer {
  const key = process.env.MOYASAR_MASTER_KEY;
  if (!key) {
    throw new Error("MOYASAR_MASTER_KEY environment variable is not set");
  }
  const buf = Buffer.from(key, "hex");
  // Fail early + clearly on a misconfigured key (wrong length, non-hex, stray
  // whitespace/base64) instead of an opaque "Invalid key length" at cipher-init.
  if (buf.length !== 32) {
    throw new Error("MOYASAR_MASTER_KEY must be 32 bytes (64 hex chars) for AES-256-GCM");
  }
  return buf;
}

/** Encrypt a gateway secret. Returns `m1:iv:authTag:ciphertext` (iv/tag/ct base64). */
export function encryptMoyasar(plaintext: string): string {
  const key = getMoyasarKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${VERSION_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt a value produced by encryptMoyasar(). **Fail-CLOSED**: a malformed
 * envelope or a GCM auth-tag failure THROWS — never returns forged or plaintext
 * output. There is NO legacy-plaintext passthrough: every gateway secret is
 * written through encryptMoyasar, so a non-`m1:` value is a hard error.
 */
export function decryptMoyasar(encryptedValue: string): string {
  if (!encryptedValue || !encryptedValue.startsWith(VERSION_PREFIX)) {
    throw new Error("[moyasar-crypto] not a gateway ciphertext (missing m1: envelope)");
  }
  const parts = encryptedValue.slice(VERSION_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("[moyasar-crypto] malformed gateway ciphertext envelope");
  }
  const key = getMoyasarKey();
  const iv = Buffer.from(parts[0]!, "base64");
  const authTag = Buffer.from(parts[1]!, "base64");
  const ciphertext = parts[2]!;
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  try {
    decrypted += decipher.final("utf8");
  } catch (err) {
    console.error("[moyasar-crypto] AES-GCM authentication failed — possible tampering or key mismatch.");
    throw err; // never hand back forged/corrupted plaintext
  }
  return decrypted;
}

/** Encrypt only when a value is present; null/empty → null (column stays NULL). */
export function encryptMoyasarOptional(value: string | null | undefined): string | null {
  return value == null || value === "" ? null : encryptMoyasar(value);
}
