import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateKeyPairSync, verify as cryptoVerify } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import { signInvoice, buildSignedProperties } from "../src/xades";
import { computeInvoiceHash } from "../src/hash";
import { decodeQrTlv } from "../src/qr";

const NS_DS = "http://www.w3.org/2000/09/xmldsig#";
const here = dirname(fileURLToPath(import.meta.url));
const read = (type: string, f: string): string => readFileSync(join(here, "golden", type, f), "utf8");

// Cert from the committed golden signed XML (public); ephemeral secp256k1 key (no private key in the repo).
const certificateBase64 = new DOMParser()
  .parseFromString(read("standard", "signed.xml"), "text/xml")
  .getElementsByTagNameNS(NS_DS, "X509Certificate")
  .item(0)!.textContent!;
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "secp256k1" });
const privateKeyPem = privateKey.export({ type: "sec1", format: "pem" }).toString();

const firstText = (xml: string, ns: string, ln: string): string =>
  new DOMParser().parseFromString(xml, "text/xml").getElementsByTagNameNS(ns, ln).item(0)!.textContent!;

/**
 * NOTE: the authoritative signer gate is `fatoora -validate` PASS on the output (run manually against the
 * Java SDK in the P0 spike — standard/credit/debit PASS; simplified fail only the dummy-cert QR-crypto, like
 * the SDK). These tests cover the deterministic, CI-safe correctness properties the validator relies on.
 */
describe("signInvoice (XAdES)", () => {
  const input = read("standard", "input.xml");
  const signed = signInvoice(input, { privateKeyPem, certificateBase64, signingTime: "2026-06-21T11:52:02Z" });

  it("inserts UBLExtensions, the QR document reference, and cac:Signature", () => {
    expect(signed).toContain("<ext:UBLExtensions>");
    expect(signed).toContain("<cbc:ID>QR</cbc:ID>");
    expect(signed).toContain("urn:oasis:names:specification:ubl:signature:Invoice");
    expect(signed).toContain('Id="xadesSignedProperties"');
  });

  it("SignatureValue is a valid ECDSA signature over the invoice hash (verifies with the signing key)", () => {
    const sig = Buffer.from(firstText(signed, NS_DS, "SignatureValue").replace(/\s/g, ""), "base64");
    const invoiceHashBinary = Buffer.from(computeInvoiceHash(input), "base64");
    expect(cryptoVerify("sha256", invoiceHashBinary, publicKey, sig)).toBe(true);
  });

  it("embeds the invoice digest in Reference-1", () => {
    const digests = [...signed.matchAll(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/g)].map((m) => m[1]);
    expect(digests[0]).toBe(computeInvoiceHash(input));
  });

  it("standard QR has 8 tags; simplified QR has 9 (adds CertificateSignature)", () => {
    // Extract the QR ref's payload specifically (the PIH ref also has an EmbeddedDocumentBinaryObject).
    const qrOf = (xml: string): string =>
      xml.match(/<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)</)![1]!;

    expect(decodeQrTlv(qrOf(signed)).map((t) => t.tag)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const simplified = signInvoice(read("simplified", "input.xml"), {
      privateKeyPem,
      certificateBase64,
      signingTime: "2026-06-21T11:52:02Z",
    });
    expect(decodeQrTlv(qrOf(simplified)).map((t) => t.tag)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("buildSignedProperties", () => {
  it("produces the exact ZATCA template (xmlns:xades + per-element xmlns:ds, fixed indentation)", () => {
    const sp = buildSignedProperties("2026-06-21T11:52:02Z", "CERTHASH", "CN=Issuer", "12345");
    expect(sp.startsWith('<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">')).toBe(true);
    expect(sp).toContain("<xades:SigningTime>2026-06-21T11:52:02Z</xades:SigningTime>");
    expect(sp).toContain('<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">CERTHASH</ds:DigestValue>');
    expect(sp).toContain("<ds:X509SerialNumber xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\">12345</ds:X509SerialNumber>");
    expect(sp.endsWith("</xades:SignedProperties>")).toBe(true);
  });
});
