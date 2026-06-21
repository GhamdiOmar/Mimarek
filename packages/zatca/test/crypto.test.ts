import { describe, it, expect } from "vitest";
import { createPrivateKey } from "node:crypto";
import { generateCsr, type CsrConfig } from "../src/crypto";

const cfg: CsrConfig = {
  commonName: "TST-886431145-312345678900003",
  serialNumber: "1-TST|2-TST|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f",
  organizationIdentifier: "312345678900003",
  organizationUnitName: "3123456789",
  organizationName: "3123456789",
  countryName: "SA",
  invoiceType: "1100",
  locationAddress: "Riyadh",
  industryBusinessCategory: "Real estate",
  environment: "sandbox",
};

const derOf = (pem: string): Buffer =>
  Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""), "base64");

describe("generateCsr (PKCS#10, secp256k1)", () => {
  const csr = generateCsr(cfg);

  it("emits a valid PEM CSR + a usable EC private key", () => {
    expect(csr.csrPem).toMatch(/^-----BEGIN CERTIFICATE REQUEST-----/);
    expect(csr.csrPem.trimEnd()).toMatch(/-----END CERTIFICATE REQUEST-----$/);
    expect(() => createPrivateKey(csr.privateKeyPem)).not.toThrow();
    expect(derOf(csr.csrPem)[0]).toBe(0x30); // outer SEQUENCE
  });

  it("carries the ZATCA subject, template-name extension, and SAN identity values", () => {
    const der = derOf(csr.csrPem);
    expect(der.includes(Buffer.from(cfg.commonName))).toBe(true);
    expect(der.includes(Buffer.from("TSTZATCA-Code-Signing"))).toBe(true);
    expect(der.includes(Buffer.from(cfg.serialNumber))).toBe(true);
    expect(der.includes(Buffer.from(cfg.organizationIdentifier))).toBe(true);
    // OID 1.3.6.1.4.1.311.20.2 (cert-template-name) DER body
    expect(der.includes(Buffer.from([0x2b, 0x06, 0x01, 0x04, 0x01, 0x82, 0x37, 0x14, 0x02]))).toBe(true);
    // OID 2.5.29.17 (subjectAltName) DER body
    expect(der.includes(Buffer.from([0x55, 0x1d, 0x11]))).toBe(true);
  });

  it("switches the cert-template name by environment", () => {
    expect(derOf(generateCsr({ ...cfg, environment: "production" }).csrPem).includes(Buffer.from("ZATCA-Code-Signing"))).toBe(true);
    expect(derOf(generateCsr({ ...cfg, environment: "simulation" }).csrPem).includes(Buffer.from("PREZATCA-Code-Signing"))).toBe(true);
  });

  it("produces a fresh keypair each call (CSR bytes differ)", () => {
    expect(generateCsr(cfg).csrPem).not.toBe(generateCsr(cfg).csrPem);
  });
});
