import { createHash, createPrivateKey, sign as cryptoSign, X509Certificate, type KeyObject } from "node:crypto";
import { computeInvoiceHash } from "./hash.js";
import { computeCertHash } from "./cert.js";
import { deterministicQrTags, encodeQrTlv, type QrTlvTag } from "./qr.js";

/**
 * ZATCA XAdES signer — produces a signed UBL invoice that passes `fatoora -validate`.
 *
 * Mirrors the ZATCA SDK / the `Saleh7/php-zatca-xml` reference, with the recipe reverse-engineered +
 * verified in the P0 spike:
 *  - **SignatureValue = ECDSA-sign('sha256', invoiceHashBinary)** — ZATCA signs the invoice HASH, not the
 *    canonicalized SignedInfo (verified: the golden signature validates against the invoice hash).
 *  - Cert + SignedProperties digests = `base64(hex(sha256(...)))`; invoice digest = `base64(raw sha256)`.
 *  - Cert hash hashes the base64 cert STRING (see cert.ts).
 *  - The SignedProperties is hashed AND emitted from one verbatim template (self-consistent for the
 *    validator's Reference-2 recomputation).
 *
 * Verification gate: `fatoora -validate` PASS on the signed output (NOT byte-match — SigningTime + ECDSA
 * random-k make it non-deterministic).
 */
export interface SignOptions {
  /** PEM (SEC1 `EC PRIVATE KEY`) or raw base64 secp256k1 private key. */
  privateKeyPem: string;
  /** Base64 certificate body (the text that goes in `<ds:X509Certificate>`; PEM headers/whitespace ignored). */
  certificateBase64: string;
  /** ISO-8601 signing time, e.g. `2026-06-21T11:52:02Z`. Defaults to now (UTC, second precision). */
  signingTime?: string;
}

const sha256hex = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");
const b64ofHex = (s: string): string => Buffer.from(sha256hex(s), "utf8").toString("base64");

const SP_LINES: ReadonlyArray<[number, string]> = [
  [0, '<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">'],
  [32, "<xades:SignedSignatureProperties>"],
  [36, "<xades:SigningTime>{{TIME}}</xades:SigningTime>"],
  [36, "<xades:SigningCertificate>"],
  [40, "<xades:Cert>"],
  [44, "<xades:CertDigest>"],
  [48, '<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>'],
  [48, '<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">{{DIGEST}}</ds:DigestValue>'],
  [44, "</xades:CertDigest>"],
  [44, "<xades:IssuerSerial>"],
  [48, '<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">{{ISSUER}}</ds:X509IssuerName>'],
  [48, '<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">{{SERIAL}}</ds:X509SerialNumber>'],
  [44, "</xades:IssuerSerial>"],
  [40, "</xades:Cert>"],
  [36, "</xades:SigningCertificate>"],
  [32, "</xades:SignedSignatureProperties>"],
  [28, "</xades:SignedProperties>"],
];

/** Build the exact ZATCA SignedProperties template (hashed AND emitted verbatim). */
export function buildSignedProperties(signingTime: string, certHash: string, issuer: string, serial: string): string {
  return SP_LINES.map(([indent, content]) => " ".repeat(indent) + content)
    .join("\n")
    .replace("{{TIME}}", signingTime)
    .replace("{{DIGEST}}", certHash)
    .replace("{{ISSUER}}", issuer)
    .replace("{{SERIAL}}", serial);
}

function loadPrivateKey(pem: string): KeyObject {
  const trimmed = pem.trim();
  if (trimmed.includes("-----BEGIN")) return createPrivateKey(trimmed);
  // Headerless base64 (the SDK ships the key this way) — wrap as SEC1.
  const body = trimmed.replace(/\s+/g, "").replace(/(.{64})/g, "$1\n");
  return createPrivateKey(`-----BEGIN EC PRIVATE KEY-----\n${body}\n-----END EC PRIVATE KEY-----`);
}

interface CertInfo {
  base64: string;
  hash: string;
  issuer: string;
  serial: string;
  spkiDer: Buffer;
  signature: Buffer;
}

/** Read a DER length at `pos`; returns [length, contentStart]. */
function readDerLen(der: Buffer, pos: number): [number, number] {
  const first = der[pos]!;
  if (first < 0x80) return [first, pos + 1];
  const n = first & 0x7f;
  let len = 0;
  for (let i = 0; i < n; i++) len = (len << 8) | der[pos + 1 + i]!;
  return [len, pos + 1 + n];
}

/**
 * Extract the certificate's own signature value (the QR tag-9 / CertificateSignature).
 * Certificate ::= SEQUENCE { tbsCertificate SEQUENCE, signatureAlgorithm SEQUENCE, signatureValue BIT STRING }.
 * Returns the BIT STRING content minus the leading unused-bits byte (matches php `substr($sig, 1)`).
 */
function derCertSignature(der: Buffer): Buffer {
  let pos = 0;
  if (der[pos++] !== 0x30) throw new Error("cert: expected outer SEQUENCE");
  [, pos] = readDerLen(der, pos);
  for (const _ of [0, 1]) {
    if (der[pos++] !== 0x30) throw new Error("cert: expected SEQUENCE");
    const [len, start] = readDerLen(der, pos);
    pos = start + len; // skip tbsCertificate, then signatureAlgorithm
  }
  if (der[pos++] !== 0x03) throw new Error("cert: expected signatureValue BIT STRING");
  const [len, start] = readDerLen(der, pos);
  return der.subarray(start + 1, start + len); // drop the unused-bits count byte
}

function readCertificate(certificateBase64: string): CertInfo {
  const base64 = certificateBase64.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Buffer.from(base64, "base64");
  const x509 = new X509Certificate(der);
  // ZATCA issuer order is CN-first; Node renders DN components in reverse, newline-separated.
  const issuer = x509.issuer.split("\n").reverse().join(", ");
  const serial = BigInt(`0x${x509.serialNumber}`).toString();
  const spkiDer = x509.publicKey.export({ type: "spki", format: "der" });
  return { base64, hash: computeCertHash(base64), issuer, serial, spkiDer, signature: derCertSignature(der) };
}

function buildUblExtensions(p: {
  invoiceDigest: string;
  signedPropsDigest: string;
  signatureValue: string;
  certBase64: string;
  signedProperties: string;
}): string {
  return `<ext:UBLExtension>
    <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
    <ext:ExtensionContent>
        <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
            <sac:SignatureInformation>
                <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
                    <ds:SignedInfo>
                        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
                        <ds:Reference Id="invoiceSignedData" URI="">
                            <ds:Transforms>
                                <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath></ds:Transform>
                                <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath></ds:Transform>
                                <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath></ds:Transform>
                                <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                            </ds:Transforms>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                            <ds:DigestValue>${p.invoiceDigest}</ds:DigestValue>
                        </ds:Reference>
                        <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
                            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                            <ds:DigestValue>${p.signedPropsDigest}</ds:DigestValue>
                        </ds:Reference>
                    </ds:SignedInfo>
                    <ds:SignatureValue>${p.signatureValue}</ds:SignatureValue>
                    <ds:KeyInfo>
                        <ds:X509Data>
                            <ds:X509Certificate>${p.certBase64}</ds:X509Certificate>
                        </ds:X509Data>
                    </ds:KeyInfo>
                    <ds:Object>
                        <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
                            ${p.signedProperties}
                        </xades:QualifyingProperties>
                    </ds:Object>
                </ds:Signature>
            </sac:SignatureInformation>
        </sig:UBLDocumentSignatures>
    </ext:ExtensionContent>
</ext:UBLExtension>`;
}

function qrNode(qrBase64: string): string {
  return `<cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrBase64}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
        <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
        <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
    </cac:Signature>`;
}

function isSimplified(invoiceXml: string): boolean {
  const m = invoiceXml.match(/<cbc:InvoiceTypeCode[^>]*\bname="(\d{2})/);
  return m?.[1] === "02";
}

/** Sign an unsigned ZATCA UBL invoice → signed XML (with `ext:UBLExtensions`, QR, and `cac:Signature`). */
export function signInvoice(invoiceXml: string, opts: SignOptions): string {
  const privateKey = loadPrivateKey(opts.privateKeyPem);
  const cert = readCertificate(opts.certificateBase64);
  const signingTime = opts.signingTime ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const signedProperties = buildSignedProperties(signingTime, cert.hash, cert.issuer, cert.serial);
  const signedPropsDigest = b64ofHex(signedProperties);

  // Inject the three hash-EXCLUDED elements (UBLExtensions, QR doc-ref, cac:Signature) at fixed points.
  // Guard each anchor: a missing tag would otherwise silently return an UNSIGNED doc with a bogus
  // signature (literal-string `.replace` no-ops when the needle is absent) — fail hard instead.
  const assemble = (ublExtensionInner: string, qrBase64: string): string => {
    const withExt = invoiceXml.replace(
      "<cbc:ProfileID>",
      `<ext:UBLExtensions>${ublExtensionInner}</ext:UBLExtensions>\n    <cbc:ProfileID>`,
    );
    if (withExt === invoiceXml) throw new Error("signInvoice: invoice XML is missing the <cbc:ProfileID> anchor");
    const withQr = withExt.replace(
      "<cac:AccountingSupplierParty>",
      `${qrNode(qrBase64)}\n    <cac:AccountingSupplierParty>`,
    );
    if (withQr === withExt) {
      throw new Error("signInvoice: invoice XML is missing the <cac:AccountingSupplierParty> anchor");
    }
    // Drop blank lines (mirror the reference) for clean output.
    return withQr.replace(/^[ \t]*[\r\n]+/gm, "");
  };

  // The invoice digest MUST be taken from the FINAL assembled body — ZATCA strips the three excluded
  // elements and re-hashes what remains, and the injection introduces whitespace text nodes the raw input
  // doesn't have. Hashing the raw input here is the classic ZATCA `invalid-invoice-hash` bug. So: assemble a
  // skeleton (the excluded content is irrelevant — it's stripped), hash THAT, then refill the excluded
  // regions (which never changes the hashed body, so the digest still holds).
  const skeleton = assemble("", "");
  const invoiceDigest = computeInvoiceHash(skeleton);
  const invoiceHashBinary = Buffer.from(invoiceDigest, "base64");
  const signatureValue = cryptoSign("sha256", invoiceHashBinary, privateKey).toString("base64");

  const ublExtension = buildUblExtensions({
    invoiceDigest,
    signedPropsDigest,
    signatureValue,
    certBase64: cert.base64,
    signedProperties,
  });

  // QR tags 1–5 from the invoice + 6 = the (final-body) invoice digest + 7 signature + 8 public key
  // [+ 9 cert-sig for simplified]. Tag 6 must equal the digest ZATCA recomputes (it validates the B2C QR).
  const tags: QrTlvTag[] = [
    ...deterministicQrTags(invoiceXml).map((t) =>
      t.tag === 6 ? { tag: 6, value: new TextEncoder().encode(invoiceDigest) } : t,
    ),
    { tag: 7, value: new TextEncoder().encode(signatureValue) },
    { tag: 8, value: new Uint8Array(cert.spkiDer) },
  ];
  if (isSimplified(invoiceXml)) tags.push({ tag: 9, value: new Uint8Array(cert.signature) });

  return assemble(ublExtension, encodeQrTlv(tags));
}
