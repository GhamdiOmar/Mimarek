import { createHash } from "node:crypto";
import { DOMParser, type Document, type Element } from "@xmldom/xmldom";
import { C14nCanonicalization } from "xml-crypto";

// UBL namespaces (ZATCA invoices)
const EXT_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";
const CAC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
const CBC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

/**
 * Compute the ZATCA invoice hash (the value chained as PIH and embedded as QR tag 6 /
 * the `ds:Reference` DigestValue).
 *
 * Recipe — **confirmed byte-for-byte against the Fatoora SDK** (`test/golden/standard`, P0 spike):
 *   1. Remove the signing artifacts the ZATCA transform excludes:
 *      `ext:UBLExtensions`, `cac:Signature`, `cac:AdditionalDocumentReference[cbc:ID='QR']`.
 *   2. Inclusive Canonical XML — ZATCA specifies C14N 1.1; for a ZATCA invoice (no
 *      `xml:base`/`xml:id`/`xml:lang`) inclusive C14N 1.0 produces identical bytes, so the
 *      `xml-crypto` C14N-1.0 canonicalizer matches.
 *   3. SHA-256, base64.
 *
 * IMPORTANT: the canonical ZATCA invoice hash (the value ZATCA recomputes server-side, chains as PIH,
 * and embeds as QR tag 6 / the `ds:Reference` DigestValue) is taken over the **SIGNED** document. Hashing
 * the unsigned invoice yields a DIFFERENT digest — the signer injects the (hash-excluded) UBLExtensions/
 * QR/cac:Signature, which adds inter-element whitespace text nodes that survive the strip. Always compute
 * this over `signInvoice(...)` output for submission, PIH and QR — never over the unsigned UBL.
 */
export function computeInvoiceHash(invoiceXml: string): string {
  const doc = new DOMParser().parseFromString(invoiceXml, "text/xml") as unknown as Document;
  stripSigningArtifacts(doc);
  const root = doc.documentElement;
  if (!root) throw new Error("invoice XML has no document element");

  type ProcessNode = Parameters<C14nCanonicalization["process"]>[0];
  type ProcessOpts = Parameters<C14nCanonicalization["process"]>[1];
  const canonical = new C14nCanonicalization().process(root as unknown as ProcessNode, {} as ProcessOpts);

  return createHash("sha256").update(String(canonical), "utf8").digest("base64");
}

/** Remove the three elements the ZATCA invoice-hash transform excludes (idempotent). */
function stripSigningArtifacts(doc: Document): void {
  const all = doc.getElementsByTagName("*");
  const toRemove: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    const el = all.item(i);
    if (!el) continue;
    if (el.namespaceURI === EXT_NS && el.localName === "UBLExtensions") {
      toRemove.push(el);
    } else if (el.namespaceURI === CAC_NS && el.localName === "Signature") {
      toRemove.push(el);
    } else if (el.namespaceURI === CAC_NS && el.localName === "AdditionalDocumentReference") {
      const ids = el.getElementsByTagNameNS(CBC_NS, "ID");
      const first = ids.item(0);
      if (first && (first.textContent ?? "").trim() === "QR") toRemove.push(el);
    }
  }
  for (const el of toRemove) el.parentNode?.removeChild(el);
}
