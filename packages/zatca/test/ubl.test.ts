import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import { buildInvoice, type ZatcaInvoiceInput, type ZatcaParty } from "../src/ubl";
import { computeInvoiceHash } from "../src/hash";
import { signInvoice } from "../src/xades";

const here = dirname(fileURLToPath(import.meta.url));
const certificateBase64 = new DOMParser()
  .parseFromString(readFileSync(join(here, "golden", "standard", "signed.xml"), "utf8"), "text/xml")
  .getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "X509Certificate")
  .item(0)!.textContent!;

const seller: ZatcaParty = {
  registrationName: "Maximum Speed Tech Supply LTD",
  vatNumber: "399999999900003",
  crn: "1010010000",
  address: { street: "Prince Sultan", building: "2322", citySubdivision: "Al-Murabba", city: "Riyadh", postalZone: "23333" },
};
const buyer: ZatcaParty = {
  registrationName: "Fatoora Samples LTD",
  vatNumber: "399999999800003",
  address: { street: "Salah Al-Din", building: "1111", citySubdivision: "Al-Murooj", city: "Riyadh", postalZone: "12222" },
};
const base: Omit<ZatcaInvoiceInput, "docType"> = {
  id: "BUILT-001", uuid: "aaaaaaaa-0000-0000-0000-000000000001",
  issueDate: "2024-09-07", issueTime: "12:21:28", icv: 10, pih: "NWZl",
  seller, buyer, lines: [{ name: "Office lease", quantity: 1, unitPrice: 100, vatPercent: 15 }],
};

describe("buildInvoice (UBL builder)", () => {
  it("emits a standard tax invoice with reconciling totals", () => {
    const xml = buildInvoice({ ...base, docType: "invoice" });
    expect(xml).toContain('<cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:TaxableAmount currencyID="SAR">100.00</cbc:TaxableAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="SAR">115.00</cbc:TaxInclusiveAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="SAR">115.00</cbc:PayableAmount>');
    expect(xml).toContain("<cbc:CompanyID>399999999900003</cbc:CompanyID>");
  });

  it("flips the type-code name flag to 02… for simplified (B2C)", () => {
    expect(buildInvoice({ ...base, docType: "invoice", simplified: true })).toContain('name="0200000"');
  });

  it("credit/debit notes carry the right type code + BillingReference + reason", () => {
    const cn = buildInvoice({ ...base, docType: "credit-note", billingReferenceId: "BUILT-001", reason: "Lease adjustment" });
    expect(cn).toContain(">381<");
    expect(cn).toContain("<cac:BillingReference>");
    expect(cn).toContain("<cbc:ID>BUILT-001</cbc:ID>");
    expect(cn).toContain("<cbc:InstructionNote>Lease adjustment</cbc:InstructionNote>");
    expect(buildInvoice({ ...base, docType: "debit-note", billingReferenceId: "BUILT-001" })).toContain(">383<");
  });

  it("computes multi-line totals (2×50 + 1×100 → taxable 200, VAT 30, incl 230)", () => {
    const xml = buildInvoice({
      ...base, docType: "invoice",
      lines: [
        { name: "a", quantity: 2, unitPrice: 50, vatPercent: 15 },
        { name: "b", quantity: 1, unitPrice: 100, vatPercent: 15 },
      ],
    });
    expect(xml).toContain('<cbc:TaxableAmount currencyID="SAR">200.00</cbc:TaxableAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="SAR">230.00</cbc:PayableAmount>');
  });

  it("integrates with the signer: signed Reference-1 digest == hash of the built invoice", () => {
    const built = buildInvoice({ ...base, docType: "invoice" });
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "secp256k1" });
    const signed = signInvoice(built, {
      privateKeyPem: privateKey.export({ type: "sec1", format: "pem" }).toString(),
      certificateBase64,
      signingTime: "2026-06-21T11:52:02Z",
    });
    const ref1 = signed.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/)![1];
    expect(ref1).toBe(computeInvoiceHash(built));
  });
});
