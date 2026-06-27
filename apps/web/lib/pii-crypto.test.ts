import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";

// Mock the security-log module boundary so we can assert the A2 plaintext-detection
// branch fires logSecurityEvent without touching real telemetry/console plumbing.
// safeDecryptField now lives in @repo/crypto and calls logSecurityEvent via the
// package-internal security-log module, so the mock must target that resolved module
// (the ./security-log shim only re-exports it; mocking the shim wouldn't intercept the
// package's own internal import). Mirrors how the suites mock the @repo/db boundary.
vi.mock("@repo/crypto/src/security-log", () => ({
  logSecurityEvent: vi.fn(),
}));

// Test-only 32-byte AES-256 key (hex) + pepper, set before the encryption module's
// getKey()/getPepper() are ever called (they read process.env at call time, not import
// time). Mirrors apps/web/lib/encryption.test.ts.
const TEST_KEY = "1f".repeat(32); // 64 hex chars = 32 bytes
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

// Imported after the env + mock above. safeDecryptField reads the key lazily inside
// decrypt(), so beforeAll() still wins.
import { encrypt } from "./encryption";
import { safeDecryptField } from "./pii-crypto";
// Pull the spy handle from the SAME module that was mocked above, so vi.mocked()
// returns the mock the @repo/crypto implementation actually calls. The ./security-log
// shim re-exports the package barrel, which would yield a different (unmocked) binding.
import { logSecurityEvent } from "@repo/crypto/src/security-log";

const logSpy = vi.mocked(logSecurityEvent);

beforeEach(() => {
  logSpy.mockClear();
});

describe("safeDecryptField — A2 plaintext-detection branch", () => {
  it("returns a plaintext value unchanged AND flags PII_PLAINTEXT_DETECTED", () => {
    const plaintext = "0551234567";
    expect(safeDecryptField(plaintext, "phone")).toBe(plaintext);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("PII_PLAINTEXT_DETECTED", "phone");
  });

  it("round-trips a v1: versioned value and does NOT flag a security event", () => {
    const original = "+966551234567";
    const versioned = encrypt(original); // v1:iv:tag:ct
    expect(safeDecryptField(versioned, "phone")).toBe(original);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("decrypts a legacy (bare iv:tag:ct) value and does NOT flag a security event", () => {
    const original = "legacy-secret";
    const legacy = encrypt(original).slice("v1:".length); // strip prefix → pre-A1 shape
    expect(safeDecryptField(legacy, "nationalId")).toBe(original);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
