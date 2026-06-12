import { describe, it, expect } from "vitest";
import { normalizeSaudiPhoneE164, toWhatsAppNumber } from "./phone";

describe("normalizeSaudiPhoneE164", () => {
  describe("valid Saudi mobiles → +9665XXXXXXXX", () => {
    const cases: [string, string][] = [
      ["0551234567", "+966551234567"],
      ["551234567", "+966551234567"],
      ["966551234567", "+966551234567"],
      ["+966551234567", "+966551234567"],
      ["00966551234567", "+966551234567"],
      ["+966 55 123 4567", "+966551234567"],
      ["055-123-4567", "+966551234567"],
      ["(055) 123 4567", "+966551234567"],
      ["0501234567", "+966501234567"],
      ["0591234567", "+966591234567"],
    ];
    it.each(cases)("normalizes %s", (input, expected) => {
      expect(normalizeSaudiPhoneE164(input)).toBe(expected);
    });
  });

  describe("identical output regardless of input format (blind-index requirement)", () => {
    it("0551234567 and +966551234567 hash-key to the same normalized value", () => {
      expect(normalizeSaudiPhoneE164("0551234567")).toBe(
        normalizeSaudiPhoneE164("+966551234567"),
      );
      expect(normalizeSaudiPhoneE164("966551234567")).toBe(
        normalizeSaudiPhoneE164("0551234567"),
      );
    });
  });

  describe("returns null for non-phones", () => {
    it("rejects empty / null / undefined", () => {
      expect(normalizeSaudiPhoneE164("")).toBeNull();
      expect(normalizeSaudiPhoneE164(null)).toBeNull();
      expect(normalizeSaudiPhoneE164(undefined)).toBeNull();
    });
    const nulls: [string, string][] = [
      ["sentinel placeholder", "—"],
      ["masked PII", "******4567"],
      ["masked PII short", "*******567"],
      ["ciphertext 3-part", "abc:def:ghi"],
      ["ciphertext-shaped", "kJ8x:aB2y:zZ99=="],
      ["landline (no 5)", "0441234567"],
      ["too short", "055123456"],
      ["too long", "05512345678"],
      ["random 10 digits", "1234567890"],
      ["non-Saudi", "+1 415 555 0100"],
      ["junk", "notaphone"],
      ["valid CC, landline prefix", "+966441234567"],
    ];
    it.each(nulls)("rejects %s", (_label, value) => {
      expect(normalizeSaudiPhoneE164(value)).toBeNull();
    });
  });
});

describe("toWhatsAppNumber", () => {
  it("returns digits-only international number without +", () => {
    expect(toWhatsAppNumber("0551234567")).toBe("966551234567");
    expect(toWhatsAppNumber("+966551234567")).toBe("966551234567");
  });
  it("returns null for masked / invalid", () => {
    expect(toWhatsAppNumber("******4567")).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
  });
});
