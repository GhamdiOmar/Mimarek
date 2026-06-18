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
import {
  encrypt,
  decrypt,
  hashForSearch,
  legacyHashForSearch,
  classifyCiphertext,
} from "./encryption";

describe("encryption — AES-256-GCM round-trip", () => {
  it("decrypt(encrypt(x)) === x for ASCII, Arabic, and Saudi phone formats", () => {
    for (const plaintext of ["hello", "+966551234567", "0551234567", "محمد العتيبي", "1234567890"]) {
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    }
  });

  it("produces the v1:iv:tag:ciphertext envelope (prefix + 3 base64 parts)", () => {
    const out = encrypt("secret");
    expect(out.startsWith("v1:")).toBe(true);
    const parts = out.slice("v1:".length).split(":");
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it("is non-deterministic (random IV) — same input, different ciphertext", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });
});

describe("encryption — QA-SEC-06 fail-closed", () => {
  it("THROWS on a tampered ciphertext (GCM auth-tag mismatch)", () => {
    // Strip the v1: envelope prefix, then split the iv:tag:ct body.
    const [iv, tag, ct] = encrypt("sensitive").slice("v1:".length).split(":");
    // Flip the last char of the ciphertext to corrupt it without changing shape.
    const flipped = ct!.slice(0, -1) + (ct!.endsWith("A") ? "B" : "A");
    // Re-prepend v1: so it stays a well-formed versioned envelope with bad ciphertext.
    expect(() => decrypt(`v1:${iv}:${tag}:${flipped}`)).toThrow();
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

describe("classifyCiphertext — envelope classifier (A1)", () => {
  it("classifies a fresh encrypt() output as versioned", () => {
    expect(classifyCiphertext(encrypt("x"))).toBe("versioned");
  });

  it("classifies a bare iv:tag:ct (3 parts, no prefix) as legacy", () => {
    const legacy = encrypt("x").slice("v1:".length); // strip the prefix → pre-A1 shape
    expect(classifyCiphertext(legacy)).toBe("legacy");
  });

  it("classifies non-ciphertext as plaintext (empty, no colon, wrong part count, malformed v1:)", () => {
    expect(classifyCiphertext("")).toBe("plaintext");
    expect(classifyCiphertext("0551234567")).toBe("plaintext"); // no colon
    expect(classifyCiphertext("a:b")).toBe("plaintext"); // 2 parts
    expect(classifyCiphertext("a:b:c:d")).toBe("plaintext"); // 4 parts
    expect(classifyCiphertext("v1:a:b")).toBe("plaintext"); // prefixed but malformed body
  });

  it("round-trips a versioned value through decrypt()", () => {
    expect(decrypt(encrypt("+966551234567"))).toBe("+966551234567");
  });

  it("decrypts a legacy (un-prefixed) ciphertext through the same path", () => {
    const legacy = encrypt("legacy-secret").slice("v1:".length);
    expect(classifyCiphertext(legacy)).toBe("legacy");
    expect(decrypt(legacy)).toBe("legacy-secret");
  });
});

describe("hashForSearch — per-tenant (v2) deterministic blind index", () => {
  const ORG = "org-test-1";

  it("is stable for the same input + org and v2-prefixed", () => {
    const h1 = hashForSearch("0551234567", ORG);
    const h2 = hashForSearch("0551234567", ORG);
    expect(h1).toBe(h2);
    expect(h1.startsWith("v2:")).toBe(true);
  });

  it("normalizes case + whitespace before hashing", () => {
    expect(hashForSearch("  Test@Example.com  ", ORG)).toBe(
      hashForSearch("test@example.com", ORG),
    );
  });

  it("is cross-tenant unlinkable — same value, different org → different hash", () => {
    expect(hashForSearch("0551234567", "org-A")).not.toBe(
      hashForSearch("0551234567", "org-B"),
    );
  });

  it("legacyHashForSearch is the v1 global-pepper form (dual-read / backfill only)", () => {
    const l = legacyHashForSearch("0551234567");
    expect(l.startsWith("v1:")).toBe(true);
    expect(legacyHashForSearch("0551234567")).toBe(l); // deterministic
  });
});
