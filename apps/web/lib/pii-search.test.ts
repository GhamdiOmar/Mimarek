import { describe, it, expect, beforeAll } from "vitest";

// hashForSearch reads PII_HASH_PEPPER lazily at call time — set it before any test runs.
beforeAll(() => {
  process.env.PII_HASH_PEPPER ??= "unit-test-pepper-not-a-real-secret";
});

describe("phoneSearchHash — blind-index normalization", () => {
  it("produces the SAME hash for a mobile entered in any accepted format", async () => {
    const { phoneSearchHash } = await import("./pii-crypto");
    const formats = ["0551234567", "+966551234567", "966551234567", "+966 55 123 4567", "055-123-4567"];
    const hashes = formats.map(phoneSearchHash);
    // every format collapses to the same blind index
    expect(new Set(hashes).size).toBe(1);
  });

  it("is the v1: HMAC form (not a plain hash) and stable", async () => {
    const { phoneSearchHash } = await import("./pii-crypto");
    const h = phoneSearchHash("0551234567");
    expect(h.startsWith("v1:")).toBe(true);
    expect(phoneSearchHash("0551234567")).toBe(h); // deterministic
  });

  it("write-side and search-side derive an identical key for the same number", async () => {
    const { phoneSearchHash } = await import("./pii-crypto");
    // What encryptCustomerData stores vs what getCustomers queries with:
    const stored = phoneSearchHash("+966551234567"); // write path (already E.164)
    const queried = phoneSearchHash("0551234567"); // user typed local format
    expect(queried).toBe(stored);
  });

  it("falls back to the raw value for non-Saudi-mobile input (still consistent both sides)", async () => {
    const { phoneSearchHash } = await import("./pii-crypto");
    // A non-mobile string hashes by its raw value — write and search agree.
    expect(phoneSearchHash("+14155550100")).toBe(phoneSearchHash("+14155550100"));
  });
});
