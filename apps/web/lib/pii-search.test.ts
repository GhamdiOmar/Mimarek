import { describe, it, expect, beforeAll } from "vitest";

// hashForSearch reads PII_HASH_PEPPER lazily at call time — set it before any test runs.
beforeAll(() => {
  process.env.PII_HASH_PEPPER ??= "unit-test-pepper-not-a-real-secret";
});

describe("phoneSearchHash — per-tenant (v2) blind-index normalization", () => {
  const ORG = "org-test-1";

  it("produces the SAME hash for a mobile entered in any accepted format", async () => {
    const { phoneSearchHash } = await import("./pii-crypto");
    const formats = ["0551234567", "+966551234567", "966551234567", "+966 55 123 4567", "055-123-4567"];
    const hashes = formats.map((f) => phoneSearchHash(f, ORG));
    // every format collapses to the same blind index
    expect(new Set(hashes).size).toBe(1);
  });

  it("is the v2: per-tenant HMAC form (not a plain hash) and stable", async () => {
    const { phoneSearchHash } = await import("./pii-crypto");
    const h = phoneSearchHash("0551234567", ORG);
    expect(h.startsWith("v2:")).toBe(true);
    expect(phoneSearchHash("0551234567", ORG)).toBe(h); // deterministic
  });

  it("is cross-tenant unlinkable — same number, different org → different hash", async () => {
    const { phoneSearchHash } = await import("./pii-crypto");
    expect(phoneSearchHash("0551234567", "org-A")).not.toBe(
      phoneSearchHash("0551234567", "org-B"),
    );
  });

  it("write-side and search-side derive an identical key for the same number", async () => {
    const { phoneSearchHash } = await import("./pii-crypto");
    // What encryptCustomerData stores vs what getCustomers queries with:
    const stored = phoneSearchHash("+966551234567", ORG); // write path (already E.164)
    const queried = phoneSearchHash("0551234567", ORG); // user typed local format
    expect(queried).toBe(stored);
  });

  it("falls back to the raw value for non-Saudi-mobile input (still consistent both sides)", async () => {
    const { phoneSearchHash } = await import("./pii-crypto");
    // A non-mobile string hashes by its raw value — write and search agree.
    expect(phoneSearchHash("+14155550100", ORG)).toBe(phoneSearchHash("+14155550100", ORG));
  });
});
