import { describe, it, expect } from "vitest";
import {
  generateCsr,
  buildInvoice,
  signInvoice,
  computeInvoiceHash,
  createZatcaClient,
  ZatcaError,
} from "../src/index.js";

/**
 * LIVE end-to-end proof against the ZATCA SANDBOX (developer-portal). OPT-IN only — gated by
 * `ZATCA_LIVE=1` so CI and the default `vitest run` never touch the network. Run locally with:
 *   ZATCA_LIVE=1 npx vitest run test/client.live.test.ts
 *
 * It exercises the real cycle the client supports without any onboarding (sandbox dummy OTP):
 *   generateCsr → POST /compliance → build+sign an invoice with the issued CCSID → POST /compliance/invoices.
 * A `transport`/`config` failure = a real integration break (assert against it). A `business` rejection
 * still proves the round-trip reached ZATCA's validator — we record which KSA codes came back.
 */
const LIVE = process.env.ZATCA_LIVE === "1";
const GENESIS_PIH = "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

(LIVE ? describe : describe.skip)("ZATCA SANDBOX — live full cycle (ZATCA_LIVE=1)", () => {
  it("generateCsr → compliance CSID → build+sign → compliance invoice check", async () => {
    const vat = "312345678900003";
    const uuid = "3cf5ee18-ee25-44ea-a444-2c37ba7f28be";

    // 1. CSR (sandbox template) — VAT must match the invoice seller for the compliance check.
    const { csrPem, privateKeyPem } = generateCsr({
      commonName: `TST-886431145-${vat}`,
      serialNumber: "1-TST|2-TST|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f",
      organizationIdentifier: vat,
      organizationUnitName: "3123456789",
      organizationName: "Mimarek Test EGS",
      countryName: "SA",
      invoiceType: "1100",
      locationAddress: "Riyadh",
      industryBusinessCategory: "Real Estate",
      environment: "sandbox",
    });

    const client = createZatcaClient({ environment: "SANDBOX" });

    // 2. Compliance CSID (dummy OTP — sandbox does not validate it).
    const csid = await client.requestComplianceCsid({ csrPem, otp: "123456" });
    expect(csid.binarySecurityToken).toBeTruthy();
    expect(csid.secret).toBeTruthy();

    // The binarySecurityToken is base64(base64-DER cert); the signer wants the inner base64-DER string.
    const certificateBase64 = Buffer.from(csid.binarySecurityToken, "base64").toString("utf8");

    // 3. Build + sign a standard B2B invoice with the issued cert.
    const built = buildInvoice({
      id: "MIM-LIVE-001",
      uuid,
      issueDate: "2026-06-22",
      issueTime: "12:00:00",
      icv: 1,
      pih: GENESIS_PIH,
      docType: "invoice",
      seller: {
        registrationName: "Mimarek Test EGS",
        vatNumber: vat,
        crn: "1010010000",
        address: { street: "Prince Sultan", building: "2322", citySubdivision: "Al-Murabba", city: "Riyadh", postalZone: "23333" },
      },
      buyer: {
        registrationName: "Fatoora Samples LTD",
        vatNumber: "399999999800003",
        address: { street: "Salah Al-Din", building: "1111", citySubdivision: "Al-Murooj", city: "Riyadh", postalZone: "12222" },
      },
      lines: [{ name: "Commercial lease", quantity: 1, unitPrice: 1000, vatPercent: 15 }],
    });
    const signed = signInvoice(built, { privateKeyPem, certificateBase64 });
    const invoiceHash = computeInvoiceHash(signed); // ZATCA's invoice hash is over the SIGNED document
    const invoiceXmlBase64 = Buffer.from(signed, "utf8").toString("base64");

    // 4. Compliance invoice check (Basic auth with the CCSID).
    const credentials = { binarySecurityToken: csid.binarySecurityToken, secret: csid.secret };
    // The client must round-trip to ZATCA: a SUCCESS outcome proves the happy path; a `business`
    // rejection still proves the integration reached ZATCA's validator. A transport/config error is a
    // real break. (Verified manually 2026-06-22: SUCCESS:CLEARED.)
    let outcome: string;
    try {
      const res = await client.checkComplianceInvoice({ credentials, payload: { invoiceHash, uuid, invoiceXmlBase64 } });
      outcome = `SUCCESS:${res.outcome}`;
    } catch (e) {
      if (e instanceof ZatcaError && e.kind === "business") {
        outcome = `BUSINESS:[${e.codes.join(",")}] ${e.message}`;
      } else {
        throw e; // transport/config = a real integration failure
      }
    }
    expect(outcome).toMatch(/^(SUCCESS|BUSINESS)/);
  }, 60_000);
});
