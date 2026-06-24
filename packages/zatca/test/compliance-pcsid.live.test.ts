import { describe, it, expect } from "vitest";
import {
  generateCsr,
  buildInvoice,
  signInvoice,
  computeInvoiceHash,
  createZatcaClient,
  type ZatcaInvoiceInput,
  type ZatcaSubmissionOutcome,
} from "../src/index.js";

/**
 * ZATCA 6-sample PCSID compliance harness (R5 — the production-CSID issuance prerequisite). GATED
 * LIVE only — `ZATCA_LIVE=1`, so CI and the default `vitest run` SKIP it (no network). Run locally:
 *   ZATCA_LIVE=1 npx vitest run test/compliance-pcsid.live.test.ts
 *
 * Before ZATCA grants a Production CSID (PCSID), the EGS must prove it can issue every required
 * document type through the compliance-invoice endpoint. This harness drives ONE compliance CSID
 * across the full 6-sample matrix (3 doc types × {standard, simplified}), each
 * `buildInvoice → signInvoice → computeInvoiceHash(SIGNED) → checkComplianceInvoice`, advancing a real
 * ICV/PIH chain (ICV 1→6; each PIH = the hash of the PREVIOUS signed doc; the first uses the genesis
 * PIH), and asserts ALL SIX clear.
 *
 * HONEST RUN PREREQUISITE — this passes ONLY against a VAT-bound production/compliance CSID. Against the
 * dev-portal SANDBOX dummy cert the three STANDARD samples (1–3) `business`-reject on the QR-crypto /
 * cert-binding check — exactly the R4a `certificate-permissions` situation (cert not bound to the
 * seller VAT). So this is the GATE CODE: wire a real bound PCSID's CSR/credentials and run with
 * `ZATCA_LIVE=1`. Do NOT weaken the all-6-SUCCESS assertion to make it pass against the dummy cert —
 * ZATCA only issues the PCSID when all six clear, so a softer assertion would defeat the harness.
 *
 * veraPDF PDF/A-3 conformance check is a sibling R5 follow-up (needs the veraPDF CLI; not wired here).
 */
const LIVE = process.env.ZATCA_LIVE === "1";
// Genesis PIH — the SHA-256 of "0" (base64), the chain seed for the first invoice (ICV 1).
const GENESIS_PIH = "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

/** The success outcomes ZATCA can return — anything else (business/transport/config) fails the harness. */
const SUCCESS = new Set<ZatcaSubmissionOutcome>(["CLEARED", "CLEARED_WITH_WARNINGS", "REPORTED"]);

(LIVE ? describe : describe.skip)("ZATCA 6-sample PCSID compliance harness", () => {
  it(
    "issues all 6 ZATCA document types against the compliance endpoint (1 CSID, chained ICV/PIH)",
    async () => {
      const vat = "312345678900003";

      // 1. ONE CSR + ONE compliance CSID — reused as credentials + cert for all 6 samples.
      const { csrPem, privateKeyPem } = generateCsr({
        commonName: `TST-886431145-${vat}`,
        serialNumber: "1-Mimarek|2-SaaS|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f",
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
      const csid = await client.requestComplianceCsid({ csrPem, otp: "123456" });
      expect(csid.binarySecurityToken).toBeTruthy();
      expect(csid.secret).toBeTruthy();

      // The binarySecurityToken is base64(base64-DER cert); the signer wants the inner base64-DER string.
      const certificateBase64 = Buffer.from(csid.binarySecurityToken, "base64").toString("utf8");
      const credentials = { binarySecurityToken: csid.binarySecurityToken, secret: csid.secret };

      const seller: ZatcaInvoiceInput["seller"] = {
        registrationName: "Mimarek Test EGS",
        vatNumber: vat,
        crn: "1010010000",
        address: {
          street: "Prince Sultan",
          building: "2322",
          citySubdivision: "Al-Murabba",
          city: "Riyadh",
          postalZone: "23333",
        },
      };
      const buyer: ZatcaInvoiceInput["buyer"] = {
        registrationName: "Fatoora Samples LTD",
        vatNumber: "399999999800003",
        address: {
          street: "Salah Al-Din",
          building: "1111",
          citySubdivision: "Al-Murooj",
          city: "Riyadh",
          postalZone: "12222",
        },
      };

      // 2. The 6-sample matrix — 3 doc types × {standard, simplified}. Each carries the build args
      //    from the task table; the ICV + PIH are filled by the chain loop below.
      const samples: Array<Pick<
        ZatcaInvoiceInput,
        "id" | "uuid" | "docType" | "simplified" | "billingReferenceId" | "reason"
      >> = [
        { id: "MIM-PCSID-1", uuid: "3cf5ee18-ee25-44ea-a444-2c37ba7f0001", docType: "invoice" },
        {
          id: "MIM-PCSID-2",
          uuid: "3cf5ee18-ee25-44ea-a444-2c37ba7f0002",
          docType: "credit-note",
          billingReferenceId: "MIM-PCSID-1",
          reason: "Partial refund — lease adjustment",
        },
        {
          id: "MIM-PCSID-3",
          uuid: "3cf5ee18-ee25-44ea-a444-2c37ba7f0003",
          docType: "debit-note",
          billingReferenceId: "MIM-PCSID-1",
        },
        { id: "MIM-PCSID-4", uuid: "3cf5ee18-ee25-44ea-a444-2c37ba7f0004", docType: "invoice", simplified: true },
        {
          id: "MIM-PCSID-5",
          uuid: "3cf5ee18-ee25-44ea-a444-2c37ba7f0005",
          docType: "credit-note",
          simplified: true,
          billingReferenceId: "MIM-PCSID-4",
          reason: "Partial refund — lease adjustment",
        },
        {
          id: "MIM-PCSID-6",
          uuid: "3cf5ee18-ee25-44ea-a444-2c37ba7f0006",
          docType: "debit-note",
          simplified: true,
          billingReferenceId: "MIM-PCSID-4",
        },
      ];

      // 3. Drive the chain: ICV advances 1→6; each PIH = computeInvoiceHash of the PREVIOUS signed doc
      //    (genesis for the first). This mirrors a real EGS PIH chain.
      const results: Array<{ id: string; outcome: ZatcaSubmissionOutcome }> = [];
      let pih = GENESIS_PIH;

      for (let i = 0; i < samples.length; i++) {
        const s = samples[i]!;
        const built = buildInvoice({
          id: s.id,
          uuid: s.uuid,
          issueDate: "2026-06-24",
          issueTime: "12:00:00",
          icv: i + 1, // ICV 1 → 6
          pih,
          docType: s.docType,
          simplified: s.simplified,
          billingReferenceId: s.billingReferenceId,
          reason: s.reason,
          seller,
          // A simplified (B2C) document does not require a VAT-registered buyer; standard/B2B does.
          buyer: s.simplified ? undefined : buyer,
          lines: [{ name: "Commercial lease", quantity: 1, unitPrice: 1000, vatPercent: 15 }],
        });

        const signed = signInvoice(built, { privateKeyPem, certificateBase64 });
        const invoiceHash = computeInvoiceHash(signed); // ZATCA's hash is over the SIGNED doc (landmine)
        const invoiceXmlBase64 = Buffer.from(signed, "utf8").toString("base64");

        const res = await client.checkComplianceInvoice({
          credentials,
          payload: { invoiceHash, uuid: s.uuid, invoiceXmlBase64 },
        });
        results.push({ id: s.id, outcome: res.outcome });

        // Chain the next PIH off THIS signed doc's hash.
        pih = invoiceHash;
      }

      // 4. STRICTER than the single-doc live test (which tolerates a `business` reject on an unbound
      //    cert): every one of the 6 must be a ZATCA SUCCESS. ZATCA only grants the PCSID when all
      //    six clear — so any business/transport/config failure correctly fails this harness.
      expect(results).toHaveLength(6);
      expect(results.every((r) => SUCCESS.has(r.outcome))).toBe(true);
    },
    120_000,
  );
});
