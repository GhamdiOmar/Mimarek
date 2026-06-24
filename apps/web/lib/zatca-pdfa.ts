import "server-only";

import { db } from "@repo/db";
import { PDFDocument, StandardFonts, AFRelationship, PDFName, rgb } from "pdf-lib";
import QRCode from "qrcode";

/**
 * ZATCA "legal copy" PDF generator (R5 / v5.6.0).
 *
 * HONESTY CONTRACT — read before extending. The legally-meaningful artifact this produces is the
 * cleared/reported e-invoice **UBL XML embedded inside a PDF** (the machine-readable document
 * travels with a human-readable copy). The PDF/A-3 *structure* is best-effort:
 *   - an embedded file with `AFRelationship = Source` (the e-invoice XML), and
 *   - a `pdfaid:part=3` / `pdfaid:conformance=B` XMP packet on the catalog Metadata.
 *
 * This is **NOT** strict, veraPDF-validated PDF/A-3b conformance. Strict conformance additionally
 * requires an ICC-based OutputIntent, fully embedded (subsetted) fonts, and a veraPDF pass — a
 * documented R5 follow-up. Nothing here (labels/UI/copy) claims "PDF/A-3 certified"; everywhere it
 * is a "legal copy (embedded e-invoice XML)".
 *
 * The visible layer is intentionally Latin text + Western numbers + the QR image only — Arabic
 * vector-font embedding (and an sRGB OutputIntent) are the remaining conformance gaps, deferred.
 */

// Only `CLEARED` / `REPORTED` documents carry a ZATCA legal XML; everything else (receipts, HELD,
// drafts, rejected) has nothing to embed.
const LEGAL_STATUSES = new Set(["CLEARED", "REPORTED"]);

/**
 * SECURITY: select ONLY display / public columns. NEVER select privateKeyPem / csr / token /
 * secret / certificateBase64, and NEVER call getEgsSigningContext / decryptZatca from here. The
 * EGS join is constrained to two public seller-identity fields.
 */
const PDF_SELECT = {
  documentNumber: true,
  uuid: true,
  documentType: true,
  zatcaStatus: true,
  clearedXml: true,
  xmlContent: true,
  zatcaQrCode: true,
  buyerName: true,
  buyerVatNumber: true,
  subtotal: true,
  vatAmount: true,
  total: true,
  currency: true,
  egsUnit: { select: { legalNameEn: true, vatNumber: true } },
} as const;

/** Format a Decimal (Prisma `Decimal` | string | number) for the printed summary. */
function money(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
}

/** A minimal PDF/A-3 (part=3, conformance=B) XMP packet. Best-effort — see the honesty contract. */
function buildXmpPacket(documentNumber: string, uuid: string): string {
  const now = new Date().toISOString();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const title = esc(documentNumber);
  const docId = esc(uuid);
  // The XMP packet header begins with a UTF-8 BOM (U+FEFF) by spec — built via fromCharCode so the
  // raw BOM never appears as an "irregular whitespace" literal in source.
  const bom = String.fromCharCode(0xfeff);
  return `<?xpacket begin="${bom}" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <dc:title>
        <rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt>
      </dc:title>
      <dc:identifier>${docId}</dc:identifier>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Build the legal-copy PDF for a tenant document: a human-readable A4 summary page (seller, buyer,
 * totals, QR) with the cleared/reported ZATCA e-invoice UBL XML embedded as an associated file.
 *
 * Org-scoped (the `organizationId` is part of the `where` — cross-org isolation, §8). Throws when
 * the document is not found in the org or has no legal XML (receipt / HELD / draft / rejected).
 */
export async function buildLegalPdfA3(documentId: string, organizationId: string): Promise<Uint8Array> {
  const doc = await db.tenantDocument.findFirst({
    where: { id: documentId, organizationId },
    select: PDF_SELECT,
  });
  if (!doc) throw new Error("Document not found.");
  if (!LEGAL_STATUSES.has(doc.zatcaStatus)) {
    throw new Error("No legal e-invoice XML for this document.");
  }

  // Embed rule (see zatca-issuance.ts): the cleared XML is base64 ZATCA-stamped; otherwise the raw
  // signed UBL is plain UTF-8. CLEARED → clearedXml (preferred); REPORTED → xmlContent.
  const legalXmlBytes = doc.clearedXml
    ? Buffer.from(doc.clearedXml, "base64")
    : Buffer.from(doc.xmlContent ?? "", "utf8");

  const pdfDoc = await PDFDocument.create();
  const now = new Date();
  pdfDoc.setTitle(doc.documentNumber);
  pdfDoc.setSubject("ZATCA Tax Invoice — Legal Copy (embedded e-invoice XML)");
  pdfDoc.setProducer("Mimarek PropTech — ZATCA legal copy");
  pdfDoc.setCreationDate(now);
  pdfDoc.setModificationDate(now);

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  // A4 portrait (595.28 × 841.89 pt).
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const marginX = 48;
  const ink = rgb(0.05, 0.1, 0.13);
  const muted = rgb(0.4, 0.45, 0.48);
  const teal = rgb(0, 0.44, 0.48);
  let y = height - 56;

  const line = (text: string, font = helv, size = 11, color = ink) => {
    page.drawText(text, { x: marginX, y, size, font, color });
    y -= size + 7;
  };
  const label = (text: string) => {
    page.drawText(text.toUpperCase(), { x: marginX, y, size: 8, font: helvBold, color: muted });
    y -= 13;
  };

  // Header
  page.drawText("ZATCA Tax Invoice — Legal Copy", { x: marginX, y, size: 18, font: helvBold, color: teal });
  y -= 26;
  page.drawText("Embedded machine-readable e-invoice (UBL 2.1)", { x: marginX, y, size: 9, font: helv, color: muted });
  y -= 24;

  // Document number (mono)
  label("Document number");
  line(doc.documentNumber, courier, 12);
  label("Document UUID");
  line(doc.uuid, courier, 9, muted);
  y -= 6;

  // Seller
  label("Seller");
  line(doc.egsUnit?.legalNameEn ?? "—", helvBold, 11);
  line(`VAT: ${doc.egsUnit?.vatNumber ?? "—"}`, helv, 10, muted);
  y -= 6;

  // Buyer
  label("Buyer");
  line(doc.buyerName ?? "—", helvBold, 11);
  line(`VAT: ${doc.buyerVatNumber ?? "—"}`, helv, 10, muted);
  y -= 6;

  // Totals
  const cur = doc.currency ?? "SAR";
  label("Totals");
  line(`Subtotal (excl. VAT):  ${money(doc.subtotal)} ${cur}`, courier, 11);
  line(`VAT (15%):             ${money(doc.vatAmount)} ${cur}`, courier, 11);
  line(`Total (incl. VAT):     ${money(doc.total)} ${cur}`, helvBold, 12, teal);
  y -= 10;

  line("Machine-readable ZATCA e-invoice (UBL 2.1) attached to this PDF.", helv, 9, muted);

  // QR — decode the TLV base64 to a PNG and embed it.
  if (doc.zatcaQrCode) {
    try {
      const dataUrl = await QRCode.toDataURL(doc.zatcaQrCode, { margin: 1, width: 320 });
      const pngBytes = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
      const png = await pdfDoc.embedPng(pngBytes);
      const qrSize = 120;
      page.drawImage(png, { x: width - marginX - qrSize, y: 56, width: qrSize, height: qrSize });
      page.drawText("Scan to verify", {
        x: width - marginX - qrSize,
        y: 44,
        size: 8,
        font: helv,
        color: muted,
      });
    } catch {
      // QR is supplementary — never fail the legal copy because the TLV couldn't render.
    }
  }

  // ── Embed the e-invoice XML as an associated file (PDF/A-3 structure, best-effort) ──
  await pdfDoc.attach(legalXmlBytes, `${doc.documentNumber}.xml`, {
    mimeType: "application/xml",
    description: "ZATCA e-invoice (UBL 2.1)",
    afRelationship: AFRelationship.Source,
    creationDate: now,
    modificationDate: now,
  });

  // ── XMP metadata stream (pdfaid:part=3 / conformance=B) on the catalog ──
  // pdf-lib has no high-level XMP setter; write the packet as a raw Metadata stream and link it
  // from the document catalog. This is the structural marker, not a conformance guarantee.
  try {
    const xmp = buildXmpPacket(doc.documentNumber, doc.uuid);
    const metadataStream = pdfDoc.context.stream(xmp, {
      Type: "Metadata",
      Subtype: "XML",
    });
    const metadataRef = pdfDoc.context.register(metadataStream);
    pdfDoc.catalog.set(PDFName.of("Metadata"), metadataRef);
  } catch {
    // XMP is best-effort; the embedded XML (the legal payload) is already attached above.
  }

  // `useObjectStreams: false` keeps the catalog / filespec / XMP dictionaries as plain (non
  // object-stream) objects — friendlier to PDF/A tooling and inspection, and harmless to size at
  // this scale. (Strict PDF/A-3b validation is the deferred R5 follow-up regardless.)
  return pdfDoc.save({ useObjectStreams: false });
}
