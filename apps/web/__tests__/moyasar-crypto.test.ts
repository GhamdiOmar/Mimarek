import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptMoyasar, decryptMoyasar, encryptMoyasarOptional } from "../lib/payment/moyasar-crypto";

// A valid 32-byte (64 hex char) AES-256 key.
const KEY = "0".repeat(64);

beforeEach(() => {
  vi.stubEnv("MOYASAR_MASTER_KEY", KEY);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("moyasar-crypto — m1: envelope", () => {
  it("round-trips a secret through encrypt → decrypt", () => {
    const ct = encryptMoyasar("sk_test_abc123");
    expect(ct.startsWith("m1:")).toBe(true);
    expect(decryptMoyasar(ct)).toBe("sk_test_abc123");
  });

  it("uses a fresh IV each call (no ciphertext reuse for the same plaintext)", () => {
    expect(encryptMoyasar("same")).not.toBe(encryptMoyasar("same"));
  });

  it("FAILS CLOSED on a non-m1: value (no plaintext passthrough)", () => {
    expect(() => decryptMoyasar("plaintext-key")).toThrow(/m1:/);
  });

  it("FAILS CLOSED on a malformed envelope", () => {
    expect(() => decryptMoyasar("m1:only:two")).toThrow(/malformed/);
  });

  it("FAILS CLOSED on a tampered ciphertext (GCM auth-tag mismatch)", () => {
    const ct = encryptMoyasar("secret-value");
    const [iv, tag, body] = ct.slice(3).split(":");
    const flipped = Buffer.from(body!, "base64");
    flipped[0] = flipped[0]! ^ 0xff; // corrupt one byte
    const tampered = `m1:${iv}:${tag}:${flipped.toString("base64")}`;
    expect(() => decryptMoyasar(tampered)).toThrow();
  });

  it("throws when MOYASAR_MASTER_KEY is unset", () => {
    vi.stubEnv("MOYASAR_MASTER_KEY", "");
    expect(() => encryptMoyasar("x")).toThrow(/MOYASAR_MASTER_KEY/);
  });

  it("throws on a wrong-length key (not 32 bytes)", () => {
    vi.stubEnv("MOYASAR_MASTER_KEY", "abcd"); // 2 bytes
    expect(() => encryptMoyasar("x")).toThrow(/32 bytes/);
  });

  it("encryptMoyasarOptional passes null/empty through as null", () => {
    expect(encryptMoyasarOptional(null)).toBeNull();
    expect(encryptMoyasarOptional(undefined)).toBeNull();
    expect(encryptMoyasarOptional("")).toBeNull();
    const ct = encryptMoyasarOptional("v");
    expect(ct?.startsWith("m1:")).toBe(true);
  });
});
