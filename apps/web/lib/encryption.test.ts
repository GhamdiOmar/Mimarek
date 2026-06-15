import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test-only 32-byte AES-256 key (hex) + pepper, set before the module's getKey()
// is ever called (it reads process.env at call time, not import time).
const TEST_KEY = "1f".repeat(32); // 64 hex chars = 32 bytes
const ALT_KEY = "a7".repeat(32);
const ORIGINAL_KEY = process.env.PII_ENCRYPTION_KEY;
const ORIGINAL_PEPPER = process.env.PII_HASH_PEPPER;

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  process.env.PII_HASH_PEPPER = "test-pepper";
});

afterAll(() => {
  process.env.PII_ENCRYPTION_KEY = ORIGINAL_KEY;
  process.env.PII_HASH_PEPPER = ORIGINAL_PEPPER;
});

// Imported after the env vars above are declared; encryption.ts reads the key
// lazily inside encrypt()/decrypt(), so beforeAll() still wins.
import { encrypt, decrypt, hashForSearch } from "./encryption";

describe("encryption — AES-256-GCM round-trip", () => {
  it("decrypt(encrypt(x)) === x for ASCII, Arabic, and Saudi phone formats", () => {
    for (const plaintext of ["hello", "+966551234567", "0551234567", "محمد العتيبي", "1234567890"]) {
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    }
  });

  it("produces the iv:tag:ciphertext shape (3 base64 parts)", () => {
    const parts = encrypt("secret").split(":");
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it("is non-deterministic (random IV) — same input, different ciphertext", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });
});

describe("encryption — QA-SEC-06 fail-closed", () => {
  it("THROWS on a tampered ciphertext (GCM auth-tag mismatch)", () => {
    const [iv, tag, ct] = encrypt("sensitive").split(":");
    // Flip the last char of the ciphertext to corrupt it without changing shape.
    const flipped = ct!.slice(0, -1) + (ct!.endsWith("A") ? "B" : "A");
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  it("THROWS when decrypting under the wrong key (no silent fail-open)", () => {
    const ciphertext = encrypt("under-test-key");
    process.env.PII_ENCRYPTION_KEY = ALT_KEY;
    try {
      expect(() => decrypt(ciphertext)).toThrow();
    } finally {
      process.env.PII_ENCRYPTION_KEY = TEST_KEY;
    }
  });
});

describe("encryption — legacy-plaintext passthrough", () => {
  it("returns non-encrypted values as-is (no colon, or not exactly 3 parts)", () => {
    expect(decrypt("")).toBe("");
    expect(decrypt("0551234567")).toBe("0551234567"); // no colon
    expect(decrypt("a:b")).toBe("a:b"); // 2 parts
    expect(decrypt("a:b:c:d")).toBe("a:b:c:d"); // 4 parts
  });

  it("treats a 3-part NON-ciphertext string as encrypted → throws (does not pass through)", () => {
    // Exactly 3 colon-separated parts but not valid base64 GCM data: this is the
    // ambiguous shape we deliberately treat as encrypted and fail closed on.
    expect(() => decrypt("not:a:cipher")).toThrow();
  });
});

describe("hashForSearch — deterministic blind index", () => {
  it("is stable for the same input and v1-prefixed", () => {
    const h1 = hashForSearch("0551234567");
    const h2 = hashForSearch("0551234567");
    expect(h1).toBe(h2);
    expect(h1.startsWith("v1:")).toBe(true);
  });

  it("normalizes case + whitespace before hashing", () => {
    expect(hashForSearch("  Test@Example.com  ")).toBe(hashForSearch("test@example.com"));
  });
});
