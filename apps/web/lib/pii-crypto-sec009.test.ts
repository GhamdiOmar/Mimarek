import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock the security-log boundary so the plaintext-detection branch (exercised by the
// graceful-degrade test) doesn't touch real telemetry.
vi.mock("./security-log", () => ({ logSecurityEvent: vi.fn() }));

// ─────────────────────────────────────────────────────────────────────────────
// SEC-009 — dateOfBirth / address / documentInfo are encrypted at rest.
// Pure crypto round-trip (no DB): encryptCustomerData must produce ciphertext (and
// NULL the plaintext dateOfBirth), decryptCustomerData must reconstruct the originals
// and never let the internal dateOfBirthEnc column leak.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_KEY = "2a".repeat(32); // 64 hex = 32 bytes
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

import { encryptCustomerData, decryptCustomerData } from "./pii-crypto";

const ORG = "org_sec009";
const ADDRESS = { region: "Riyadh", city: "Riyadh", district: "Al Olaya", buildingNumber: "1234" };
const DOC = { documentType: "NATIONAL_ID", documentNumber: "1098765432", issuingAuthority: "MOI" };
const DOB = "1990-05-15";

describe("SEC-009 — encryptCustomerData", () => {
  it("encrypts dateOfBirth into dateOfBirthEnc and NULLs the plaintext column", () => {
    const enc = encryptCustomerData({ dateOfBirth: DOB }, ORG);
    expect(enc.dateOfBirth).toBeNull();
    expect(typeof enc.dateOfBirthEnc).toBe("string");
    expect(enc.dateOfBirthEnc).not.toContain("1990"); // ciphertext, not the plaintext year
  });

  it("encrypts address + documentInfo into ciphertext strings (not the raw JSON)", () => {
    const enc = encryptCustomerData({ address: ADDRESS, documentInfo: DOC }, ORG);
    expect(typeof enc.address).toBe("string");
    expect(typeof enc.documentInfo).toBe("string");
    expect(enc.address).not.toContain("Riyadh");
    expect(enc.documentInfo).not.toContain("1098765432");
  });

  it("leaves absent fields untouched (no dateOfBirthEnc when no DOB)", () => {
    const enc = encryptCustomerData({ nationalId: "1098765432" }, ORG);
    expect(enc.dateOfBirthEnc).toBeUndefined();
  });
});

describe("SEC-009 — decryptCustomerData round-trip", () => {
  it("reconstructs dateOfBirth (as a Date), address, and documentInfo", () => {
    const enc = encryptCustomerData({ dateOfBirth: DOB, address: ADDRESS, documentInfo: DOC }, ORG);
    const dec = decryptCustomerData({
      dateOfBirth: enc.dateOfBirth,
      dateOfBirthEnc: enc.dateOfBirthEnc,
      address: enc.address,
      documentInfo: enc.documentInfo,
    });
    expect(dec.dateOfBirth).toBeInstanceOf(Date);
    expect((dec.dateOfBirth as Date).toISOString().startsWith("1990-05-15")).toBe(true);
    expect(dec.address).toEqual(ADDRESS);
    expect(dec.documentInfo).toEqual(DOC);
  });

  it("strips the internal dateOfBirthEnc column from the decrypted output", () => {
    const enc = encryptCustomerData({ dateOfBirth: DOB }, ORG);
    const dec = decryptCustomerData({ dateOfBirthEnc: enc.dateOfBirthEnc }) as Record<string, unknown>;
    expect(dec.dateOfBirthEnc).toBeUndefined();
  });

  it("degrades gracefully (no throw) on an undecryptable address — never JSON.parse('')", () => {
    // A non-ciphertext string that isn't valid JSON must NOT crash the row.
    expect(() => decryptCustomerData({ address: "not-ciphertext-not-json" })).not.toThrow();
    const dec = decryptCustomerData({ address: "not-ciphertext-not-json" });
    expect(dec.address).toBeNull();
  });

  it("passes through a legacy plaintext-object address unchanged (typeof guard)", () => {
    const dec = decryptCustomerData({ address: ADDRESS });
    expect(dec.address).toEqual(ADDRESS);
  });
});
