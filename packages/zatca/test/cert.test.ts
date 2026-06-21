import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import { computeCertHash } from "../src/cert";

const NS_DS = "http://www.w3.org/2000/09/xmldsig#";
const NS_XADES = "http://uri.etsi.org/01903/v1.3.2#";

const here = dirname(fileURLToPath(import.meta.url));
const signed = readFileSync(join(here, "golden", "standard", "signed.xml"), "utf8");
const doc = new DOMParser().parseFromString(signed, "text/xml");

describe("computeCertHash — byte-match vs the SDK CertDigest (P0)", () => {
  it("hashes the base64 cert string as base64(hex(sha256)) matching xades:CertDigest", () => {
    const certBase64 = doc.getElementsByTagNameNS(NS_DS, "X509Certificate").item(0)!.textContent!;
    const goldenCertDigest = doc
      .getElementsByTagNameNS(NS_XADES, "CertDigest")
      .item(0)!
      .getElementsByTagNameNS(NS_DS, "DigestValue")
      .item(0)!.textContent;
    expect(computeCertHash(certBase64)).toBe(goldenCertDigest);
  });
});
