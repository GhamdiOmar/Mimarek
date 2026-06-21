import { createHash } from "node:crypto";

/**
 * ZATCA certificate hash — used in the XAdES `xades:CertDigest` and (as input) the QR.
 *
 * **Confirmed byte-for-byte vs the Fatoora SDK** (P0 spike): ZATCA hashes the **base64 certificate
 * STRING** (the text inside `<ds:X509Certificate>`), NOT the decoded DER, and stores the digest as
 * `base64( hex( sha256(...) ) )` — i.e. the SHA-256 is hex-encoded first, then base64-encoded (the
 * ZATCA digest convention, distinct from the invoice hash which is plain `base64(raw sha256)`).
 *
 * @param certBase64 the base64 certificate body (whitespace is ignored)
 */
export function computeCertHash(certBase64: string): string {
  const normalized = certBase64.replace(/\s+/g, "");
  const hex = createHash("sha256").update(normalized, "utf8").digest("hex");
  return Buffer.from(hex, "utf8").toString("base64");
}
