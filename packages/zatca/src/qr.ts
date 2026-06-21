import { DOMParser, type Document, type Element } from "@xmldom/xmldom";
import { computeInvoiceHash } from "./hash.js";

const CAC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
const CBC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

export interface QrTlvTag {
  tag: number;
  value: Uint8Array;
}

/**
 * Encode ZATCA QR tags as base64 TLV (tag byte · length byte · value bytes), per the
 * ZATCA QR-code spec. Each value must be ≤ 255 bytes (single-byte length field).
 */
export function encodeQrTlv(tags: QrTlvTag[]): string {
  const chunks: Buffer[] = [];
  for (const { tag, value } of tags) {
    if (value.length > 255) throw new Error(`QR tag ${tag} exceeds 255 bytes (${value.length})`);
    chunks.push(Buffer.from([tag, value.length]), Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("base64");
}

/** Decode a base64 TLV QR string back into its tags. */
export function decodeQrTlv(base64: string): QrTlvTag[] {
  const bytes = Buffer.from(base64, "base64");
  const out: QrTlvTag[] = [];
  let i = 0;
  while (i + 2 <= bytes.length) {
    const tag = bytes[i];
    const len = bytes[i + 1];
    if (tag === undefined || len === undefined) break;
    i += 2;
    out.push({ tag, value: new Uint8Array(bytes.subarray(i, i + len)) });
    i += len;
  }
  return out;
}

const te = new TextEncoder();
const strTag = (tag: number, value: string): QrTlvTag => ({ tag, value: te.encode(value) });

/**
 * The 6 QR tags the EGS computes from the invoice itself (seller name, VAT, timestamp, totals,
 * invoice hash). Tags 7–9 (signature, public key, cryptographic-stamp signature) are added by the
 * signing module — self-generated for SIMPLIFIED, taken from ZATCA's cleared XML for STANDARD (D28).
 */
export function deterministicQrTags(invoiceXml: string): QrTlvTag[] {
  const doc = new DOMParser().parseFromString(invoiceXml, "text/xml") as unknown as Document;
  const root = doc.documentElement;
  if (!root) throw new Error("invoice XML has no document element");

  const supplier = firstByTag(doc, CAC_NS, "AccountingSupplierParty");
  const sellerName = supplier ? firstText(supplier, CBC_NS, "RegistrationName") : "";
  const vatNumber = supplier ? firstText(supplier, CBC_NS, "CompanyID") : "";
  const issueDate = firstText(root, CBC_NS, "IssueDate");
  const issueTime = firstText(root, CBC_NS, "IssueTime");
  const timestamp = `${issueDate}T${issueTime}Z`;

  const totals = firstByTag(doc, CAC_NS, "LegalMonetaryTotal");
  const total = totals ? firstText(totals, CBC_NS, "TaxInclusiveAmount") : "";
  // Document-level TaxTotal (a direct child of the Invoice root), not a line-level one.
  const docTaxTotal = firstDirectChild(root, CAC_NS, "TaxTotal");
  const vatTotal = docTaxTotal ? firstText(docTaxTotal, CBC_NS, "TaxAmount") : "";

  const hash = computeInvoiceHash(invoiceXml);

  return [
    strTag(1, sellerName),
    strTag(2, vatNumber),
    strTag(3, timestamp),
    strTag(4, total),
    strTag(5, vatTotal),
    strTag(6, hash),
  ];
}

function firstByTag(doc: Document, ns: string, local: string): Element | null {
  return doc.getElementsByTagNameNS(ns, local).item(0);
}

function firstText(parent: Element, ns: string, local: string): string {
  const el = parent.getElementsByTagNameNS(ns, local).item(0);
  return (el?.textContent ?? "").trim();
}

function firstDirectChild(parent: Element, ns: string, local: string): Element | null {
  const kids = parent.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids.item(i);
    if (n && n.nodeType === 1) {
      const el = n as unknown as Element;
      if (el.namespaceURI === ns && el.localName === local) return el;
    }
  }
  return null;
}
