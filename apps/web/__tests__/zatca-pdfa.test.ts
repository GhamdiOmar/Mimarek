import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Behavioral coverage for the R5 ZATCA "legal copy" PDF generator. `zatca-pdfa.ts` touches only
 * `@repo/db` + `pdf-lib` + `qrcode` (it does NOT import @repo/zatca), so it loads in the web vitest
 * env once `@repo/db` is mocked. We assert: real PDF bytes out, the e-invoice XML embedded under the
 * document-number filename, the PDF/A-3 `pdfaid` marker present, the REPORTED path uses `xmlContent`,
 * and that a doc with no legal XML (RECEIPT / NOT_APPLICABLE) throws.
 */

const findFirstMock = vi.fn();
vi.mock("@repo/db", () => ({
  db: {
    tenantDocument: {
      findFirst: (...a: unknown[]) => findFirstMock(...a),
    },
  },
}));

import { buildLegalPdfA3 } from "../lib/zatca-pdfa";

const CLEARED_DOC = {
  documentNumber: "INV-2026-00001",
  uuid: "11111111-2222-3333-4444-555555555555",
  documentType: "TAX_INVOICE",
  zatcaStatus: "CLEARED",
  // base64 of `<Invoice>cleared</Invoice>` — the cleared (preferred) XML.
  clearedXml: Buffer.from("<Invoice>cleared</Invoice>", "utf8").toString("base64"),
  xmlContent: "<Invoice>raw-signed</Invoice>",
  zatcaQrCode: Buffer.from("zatca-tlv-bytes").toString("base64"),
  buyerName: "Acme Co",
  buyerVatNumber: "300000000000003",
  subtotal: "100.00",
  vatAmount: "15.00",
  total: "115.00",
  currency: "SAR",
  egsUnit: { legalNameEn: "Mimarek Test Seller", vatNumber: "310000000000003" },
};

function decode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

describe("buildLegalPdfA3", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("returns a real PDF whose bytes start with %PDF", async () => {
    findFirstMock.mockResolvedValue(CLEARED_DOC);
    const bytes = await buildLegalPdfA3("d1", "org1");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(bytes.slice(0, 4)).toString("latin1")).toBe("%PDF");
  });

  it("scopes the fetch to the org and selects only public columns (no key/secret material)", async () => {
    findFirstMock.mockResolvedValue(CLEARED_DOC);
    await buildLegalPdfA3("d1", "org1");
    const arg = findFirstMock.mock.calls[0]![0] as { where: Record<string, unknown>; select: Record<string, unknown> };
    expect(arg.where).toEqual({ id: "d1", organizationId: "org1" });
    // Secret columns must never be selected.
    for (const secret of ["privateKeyPem", "csr", "token", "secret", "certificateBase64", "productionToken"]) {
      expect(arg.select).not.toHaveProperty(secret);
    }
    // Public columns we render are present.
    expect(arg.select.clearedXml).toBe(true);
    expect(arg.select.egsUnit).toBeTruthy();
  });

  it("embeds the e-invoice XML under the document-number filename and the pdfaid marker", async () => {
    findFirstMock.mockResolvedValue(CLEARED_DOC);
    const text = decode(await buildLegalPdfA3("d1", "org1"));
    expect(text).toContain("INV-2026-00001.xml"); // embedded-file name (AFRelationship attachment)
    expect(text).toContain("pdfaid"); // PDF/A-3 XMP structure marker (part=3 / conformance=B)
    expect(text).toContain("Source"); // AFRelationship = Source
  });

  it("uses xmlContent (raw signed UBL) for a REPORTED doc without clearedXml", async () => {
    findFirstMock.mockResolvedValue({
      ...CLEARED_DOC,
      documentNumber: "INV-2026-00002",
      zatcaStatus: "REPORTED",
      clearedXml: null,
      xmlContent: "<Invoice>reported-raw</Invoice>",
    });
    const bytes = await buildLegalPdfA3("d2", "org1");
    expect(Buffer.from(bytes.slice(0, 4)).toString("latin1")).toBe("%PDF");
    // The REPORTED filename rides through to the embedded attachment.
    expect(decode(bytes)).toContain("INV-2026-00002.xml");
  });

  it("throws when the document is not found in the org", async () => {
    findFirstMock.mockResolvedValue(null);
    await expect(buildLegalPdfA3("missing", "org1")).rejects.toThrow("Document not found.");
  });

  it("throws for a RECEIPT / NOT_APPLICABLE document (no legal XML to embed)", async () => {
    findFirstMock.mockResolvedValue({
      ...CLEARED_DOC,
      documentType: "RECEIPT",
      zatcaStatus: "NOT_APPLICABLE",
      clearedXml: null,
      xmlContent: null,
    });
    await expect(buildLegalPdfA3("rec", "org1")).rejects.toThrow("No legal e-invoice XML for this document.");
  });
});
