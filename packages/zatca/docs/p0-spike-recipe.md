# P0 spike recipe — ZATCA Phase-2 byte-match against the Java Fatoora SDK

> **Status: being researched.** A read-only research pass (ZATCA official guidelines + the
> `Saleh7/php-zatca-xml` reference) populates this file with the citable, concrete recipe for the
> P0 spike: the exact C14N transform, invoice-hash encoding, XAdES + ECDSA encoding (DER vs P1363),
> the QR-TLV tag layout per D28, the CSR ASN.1 / onboarding endpoints, candidate library pinning,
> and how to run the Java SDK as the oracle.
>
> The spike does not run until this recipe is filled AND the environment is ready
> (JDK 11–14 + `tools/zatca-sdk/`). See `../README.md`.

## Sections (to be filled by the research pass)

1. Canonicalization (C14N) — the #1 risk (algorithm + XPath transforms + byte-exactness gotchas)
2. Invoice hash (SHA-256, encoding, PIH chain + genesis value)
3. XAdES signature (enveloped; SHA-256 + secp256k1; SignedProperties; **DER vs IEEE-P1363**)
4. QR-TLV tags 1–9 (per D28: simplified self-generated vs standard from cleared XML)
5. CSR / onboarding (ASN.1 fields, OIDs, CCSID → compliance → PCSID; API endpoints + sandbox URL)
6. The 6 compliance sample documents (standard + simplified × invoice/credit/debit)
7. Candidate Node libraries + pinning (node-forge / @peculiar/xadesjs / xmldsigjs / Node crypto)
8. Running the Java Fatoora SDK as the oracle (JDK version + the byte-match command)
