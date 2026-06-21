import { generateKeyPairSync, sign as cryptoSign, type KeyObject } from "node:crypto";

/**
 * ZATCA CSR generator — secp256k1 keypair + a PKCS#10 CSR carrying ZATCA's required subject DN and
 * the `extensionRequest` extensions (the MS cert-template-name + the SAN directoryName with
 * invoice-type / VAT / EGS-serial), captured from the SDK `-csr` (recipe §6).
 *
 * NOTE: secp256k1 is not in WebCrypto/node-forge, so this hand-encodes the DER (pure, no openssl shell-out)
 * and signs with Node's secp256k1. There is no offline oracle for a CSR (the SDK has no validate-CSR
 * command); correctness is checked STRUCTURALLY (keytool -printcertreq vs the SDK `-csr`) and fully proven
 * only when ZATCA's compliance endpoint accepts it during onboarding (R2/R3).
 */

// ─── minimal DER encoder ──────────────────────────────────────────────────────
const TAG = { INT: 0x02, BITSTR: 0x03, OCTET: 0x04, OID: 0x06, UTF8: 0x0c, SEQ: 0x30, SET: 0x31 } as const;

function derLen(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const out: number[] = [];
  let v = n;
  while (v > 0) {
    out.unshift(v & 0xff);
    v >>>= 8;
  }
  return Buffer.from([0x80 | out.length, ...out]);
}
function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLen(content.length), content]);
}
const seq = (...parts: Buffer[]): Buffer => tlv(TAG.SEQ, Buffer.concat(parts));
const set = (...parts: Buffer[]): Buffer => tlv(TAG.SET, Buffer.concat(parts));
const utf8 = (s: string): Buffer => tlv(TAG.UTF8, Buffer.from(s, "utf8"));
const octet = (content: Buffer): Buffer => tlv(TAG.OCTET, content);
const ctx = (n: number, content: Buffer): Buffer => tlv(0xa0 | n, content); // constructed [n]

function oid(dotted: string): Buffer {
  const parts = dotted.split(".").map((p) => Number.parseInt(p, 10));
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  const body: number[] = [40 * a + b];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i]!;
    const enc: number[] = [];
    do {
      enc.unshift(v & 0x7f);
      v >>>= 7;
    } while (v > 0);
    for (let j = 0; j < enc.length - 1; j++) enc[j]! |= 0x80;
    body.push(...enc);
  }
  return tlv(TAG.OID, Buffer.from(body));
}

// AttributeTypeAndValue → RelativeDistinguishedName (SET of one)
const rdn = (attrOid: string, value: Buffer): Buffer => set(seq(oid(attrOid), value));

const OID = {
  cn: "2.5.4.3", o: "2.5.4.10", ou: "2.5.4.11", c: "2.5.4.6",
  surname: "2.5.4.4", title: "2.5.4.12", businessCategory: "2.5.4.15", registeredAddress: "2.5.4.26",
  uid: "0.9.2342.19200300.100.1.1",
  extensionRequest: "1.2.840.113549.1.9.14",
  certTemplateName: "1.3.6.1.4.1.311.20.2",
  subjectAltName: "2.5.29.17",
  ecdsaWithSha256: "1.2.840.10045.4.3.2",
} as const;

export interface CsrConfig {
  commonName: string; // e.g. TST-886431145-312345678900003
  serialNumber: string; // EGS serial 1-<sol>|2-<model>|3-<uuid>
  organizationIdentifier: string; // 15-digit VAT
  organizationUnitName: string;
  organizationName: string;
  countryName: string; // SA
  invoiceType: string; // e.g. 1100
  locationAddress: string;
  industryBusinessCategory: string;
  environment?: "sandbox" | "simulation" | "production";
}

export interface GeneratedCsr {
  csrPem: string;
  privateKeyPem: string; // SEC1 EC PRIVATE KEY
}

const TEMPLATE_NAME: Record<NonNullable<CsrConfig["environment"]>, string> = {
  sandbox: "TSTZATCA-Code-Signing",
  simulation: "PREZATCA-Code-Signing",
  production: "ZATCA-Code-Signing",
};

function pem(label: string, der: Buffer): string {
  const b64 = der.toString("base64").replace(/(.{64})/g, "$1\n").replace(/\n$/, "");
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}

/** Generate a secp256k1 keypair + a ZATCA-shaped PKCS#10 CSR. */
export function generateCsr(config: CsrConfig): GeneratedCsr {
  const { privateKey, publicKey }: { privateKey: KeyObject; publicKey: KeyObject } = generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
  });
  const spki = publicKey.export({ type: "spki", format: "der" }); // SubjectPublicKeyInfo

  // DER RDN order matches the SDK (keytool renders RFC2253 reverse → displays CN, O, OU, C).
  const subject = seq(
    rdn(OID.c, utf8(config.countryName)),
    rdn(OID.ou, utf8(config.organizationUnitName)),
    rdn(OID.o, utf8(config.organizationName)),
    rdn(OID.cn, utf8(config.commonName)),
  );

  const templateName = TEMPLATE_NAME[config.environment ?? "sandbox"];
  const extTemplate = seq(oid(OID.certTemplateName), octet(utf8(templateName)));
  // SubjectAltName = SEQUENCE OF GeneralName; directoryName is [4] EXPLICIT Name.
  const directoryName = seq(
    rdn(OID.surname, utf8(config.serialNumber)),
    rdn(OID.uid, utf8(config.organizationIdentifier)),
    rdn(OID.title, utf8(config.invoiceType)),
    rdn(OID.registeredAddress, utf8(config.locationAddress)),
    rdn(OID.businessCategory, utf8(config.industryBusinessCategory)),
  );
  const san = seq(ctx(4, directoryName)); // GeneralNames { [4] directoryName }
  const extSan = seq(oid(OID.subjectAltName), octet(san));

  const extensions = seq(extTemplate, extSan); // Extensions ::= SEQUENCE OF Extension
  const attributes = ctx(0, seq(oid(OID.extensionRequest), set(extensions))); // [0] IMPLICIT SET OF Attribute

  const certificationRequestInfo = seq(tlv(TAG.INT, Buffer.from([0x00])), subject, spki, attributes);

  const sigDer = cryptoSign("sha256", certificationRequestInfo, privateKey); // DER ECDSA
  const signatureAlgorithm = seq(oid(OID.ecdsaWithSha256));
  const signature = tlv(TAG.BITSTR, Buffer.concat([Buffer.from([0x00]), sigDer]));

  const csr = seq(certificationRequestInfo, signatureAlgorithm, signature);

  return {
    csrPem: pem("CERTIFICATE REQUEST", csr),
    privateKeyPem: privateKey.export({ type: "sec1", format: "pem" }).toString(),
  };
}
