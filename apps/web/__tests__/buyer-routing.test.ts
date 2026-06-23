import { describe, it, expect } from "vitest";
import {
  isValidBuyerVat,
  isCompanyBuyer,
  validateBuyerForStandardClearance,
  type BuyerFields,
} from "../lib/buyer-routing";

const completeAddress = {
  city: "Riyadh",
  district: "Al Olaya",
  streetName: "King Fahd",
  buildingNumber: "1234",
  postalCode: "12211",
};

function company(overrides: Partial<BuyerFields> = {}): BuyerFields {
  return {
    customerKind: "COMPANY",
    vatNumber: "300000000000003",
    crNumber: "1010101010",
    companyNameAr: "شركة",
    companyNameEn: "Co",
    name: "Co",
    nameArabic: "شركة",
    address: completeAddress,
    ...overrides,
  } as BuyerFields;
}

describe("ZATCA Track C buyer routing + data gate (D18)", () => {
  it("isValidBuyerVat accepts a 15-digit 3…3 VAT", () => {
    expect(isValidBuyerVat("300000000000003")).toBe(true);
    expect(isValidBuyerVat("310452938100003")).toBe(true);
  });

  it("isValidBuyerVat rejects malformed VATs", () => {
    expect(isValidBuyerVat("30000000000000")).toBe(false); // 14 digits
    expect(isValidBuyerVat("3000000000000003")).toBe(false); // 16 digits
    expect(isValidBuyerVat("100000000000001")).toBe(false); // not 3…3
    expect(isValidBuyerVat("30000000000000X")).toBe(false); // non-numeric
    expect(isValidBuyerVat(null)).toBe(false);
    expect(isValidBuyerVat(undefined)).toBe(false);
  });

  it("isCompanyBuyer is true only for customerKind COMPANY", () => {
    expect(isCompanyBuyer({ customerKind: "COMPANY" })).toBe(true);
    expect(isCompanyBuyer({ customerKind: "INDIVIDUAL" })).toBe(false);
    expect(isCompanyBuyer({ customerKind: null })).toBe(false);
  });

  it("a complete company buyer passes the standard-clearance gate", () => {
    expect(validateBuyerForStandardClearance(company())).toEqual({ valid: true, missing: [] });
  });

  it("a missing/invalid VAT fails the gate", () => {
    expect(validateBuyerForStandardClearance(company({ vatNumber: null })).missing).toContain("vatNumber");
    expect(validateBuyerForStandardClearance(company({ vatNumber: "123" })).valid).toBe(false);
  });

  it("a missing/invalid CR fails the gate", () => {
    expect(validateBuyerForStandardClearance(company({ crNumber: null })).missing).toContain("crNumber");
    expect(validateBuyerForStandardClearance(company({ crNumber: "12" })).missing).toContain("crNumber");
  });

  it("an incomplete national address fails the gate (the held-doc trigger)", () => {
    const r = validateBuyerForStandardClearance(company({ address: { city: "Riyadh" } }));
    expect(r.valid).toBe(false);
    expect(r.missing).toContain("address");
  });

  it("a missing buyer name fails the gate", () => {
    const c = company({ companyNameAr: null, companyNameEn: null, name: "" as unknown as string });
    expect(validateBuyerForStandardClearance(c).missing).toContain("companyName");
  });
});
