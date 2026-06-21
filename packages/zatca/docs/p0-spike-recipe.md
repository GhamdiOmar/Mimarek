# P0 spike recipe — ZATCA Phase-2 byte-match against the Java Fatoora SDK

> **Status: oracle stood up + verified (2026-06-21).** The Java SDK runs locally and its workflow is
> confirmed against its own readme. What remains is the engine build (UBL → C14N+hash → QR → XAdES → CSR)
> diffed against SDK golden vectors. Per plan §5.0 this is the HARD GATE — nothing above the crypto layer
> ships until all 6 document types byte-match. **SDK pass ≠ ZATCA approval** (D2).

## 0. Environment (verified)
- **JDK:** Eclipse Temurin **11.0.31** at `~/.jdks/jdk-11.0.31+11`. SDK requires Java **>=11 and <15** (readme) — in range.
- **SDK:** ZATCA E-Invoice Java SDK **v3.0.8** at `tools/zatca-sdk/zatca-envoice-sdk-203/` (gitignored; see `tools/zatca-sdk/README.md`).
- **Config:** `Configuration/config.json` regenerated with local absolute paths (shipped copy had stale `D:\` paths). All referenced files verified present.
- **Dummy credentials (testing only, ship with the SDK):** `Data/Certificates/cert.pem`, `Data/Certificates/ec-secp256k1-priv-key.pem` (secp256k1), genesis PIH `Data/PIH/pih.txt` (`NWZl...`), certPassword `123456789` (`Apps/global.json`). CSR example: `Data/Input/csr-config-example.properties`.

## 1. SDK commands (the oracle) — verified invocation
Direct-jar (bypasses the launcher; what the spike automates):
```bash
JAVA="$HOME/.jdks/jdk-11.0.31+11/bin/java.exe"
JAR="tools/zatca-sdk/zatca-envoice-sdk-203/Apps/cli-3.0.8-jar-with-dependencies.jar"
RUN() { "$JAVA" -Djdk.module.illegalAccess=deny -Djdk.sunec.disableNative=false \
        -jar "$JAR" --globalVersion 3.0.8 -certpassword 123456789 "$@"; }

RUN -generateHash -invoice sample.xml          # → invoice hash (deterministic)
RUN -qr           -invoice signed.xml          # → QR base64 (deterministic given a signed invoice)
RUN -sign  -invoice sample.xml -signedInvoice signed.xml   # → XAdES-signed XML (+ embedded hash/QR)
RUN -validate -invoice signed.xml              # → PASS / NOT PASS (schema + EN16931 + ZATCA schematron)
RUN -csr -csrConfig Data/Input/csr-config-example.properties -privateKey k.pem -generatedCsr csr.pem -pem
```
`-generateHash`, `-qr`, `-validate`, `-invoiceRequest` need no cert; `-sign` uses the configured key/cert.

## 2. Golden vectors — what to capture, and the determinism strategy
Capture per document type into `packages/zatca/test/golden/<type>/`: the **input UBL XML**, the **SDK hash**, the **SDK QR**, and the **SDK signed XML**.

Byte-match strategy (critical — not everything is byte-stable):
- **Invoice hash — CONFIRMED from the oracle (2026-06-21).** A first-try SDK-PASSING standard invoice
  (`test/golden/standard/input.xml`) gives `-generateHash` = **`DpwO39KhVlb/mzQYNMzMZTgA/xM0XqfbTnSIXfYUnFI=`**,
  which equals the first `ds:DigestValue` in the signed XML. The recipe (read off the signed `ds:Reference`):
  three XPath transforms (`REC-xpath-19991116`) removing `//ancestor-or-self::ext:UBLExtensions`,
  `//ancestor-or-self::cac:Signature`, `//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR']`
  → **`http://www.w3.org/2006/12/xml-c14n11`** → SHA-256 → base64. Inclusive C14N keeps the (unused) `xmlns:ext`
  declaration, which is why the unsigned invoice and the signed-minus-elements give the same digest. NOTE: this
  doc has no `xml:base`/`xml:id`/`xml:lang`, so inclusive **C14N 1.0 == C14N 1.1** output here — a c14n-1.0 lib
  suffices for the byte-match. **This is the primary byte-match target → retires Key Risk 1.**
- **QR-TLV:** deterministic given the invoice fields + cert public key + signature. **Simplified/B2C** = EGS self-builds all 9 tags → byte-match. **Standard/B2B** tags 6–9 come from ZATCA's cleared XML (D28) → match what the SDK embeds, don't self-mint tag 9.
- **XAdES `SignatureValue` (ECDSA/secp256k1):** **non-deterministic** (random k) unless RFC-6979 deterministic-k. So match the canonicalized `SignedInfo` + the reference **digests** (deterministic), and **verify** the signature cryptographically rather than byte-comparing it. Confirm in the spike whether the SDK uses deterministic-k.
- **CSR:** random keypair → match the **ASN.1 structure / OIDs / SAN extensions** (the `1.3.6.1.4.1.311.20.2` template + the EGS serial/VAT/invoice-type/location/industry), not the bytes.

## 3. The 6 document types (D27 — PCSID needs all 6)
standard invoice · standard credit note · standard debit note · simplified invoice · simplified credit note · simplified debit note. Each needs a canonical UBL input that `-validate` returns PASS on.

## 4. Immediate next input needed
**Canonical sample invoices** — the SDK ships none (`Data/Input` has only CSR configs). Author them (this is the `ubl` module's job anyway) and iterate against `-validate` until PASS, or seed from ZATCA's official spec samples / the `Saleh7/php-zatca-xml` fixtures (the D9 C14N porting reference). Commit the PASSing XML as the spike inputs, then run §1 to capture §2 golden vectors.

## 5. Engine build order (post-golden-vector)
1. `ubl/` — UBL 2.1 builders (invoice/note/simplified) that `-validate` PASS.
2. `xades/` C14N + invoice hash — **byte-match `-generateHash`** (the hard one; port/verify C14N vs `php-zatca-xml`).
3. `qr/` TLV — byte-match `-qr` for simplified (tags 1–9, D28).
4. `xades/` signing — SignedInfo + digests match; signature verifies.
5. `crypto/` CSR — ASN.1 structure match vs `-csr`.
Libs to pin (D9): `@peculiar/xadesjs` + `xmldsigjs` (XAdES + C14N), `node-forge`/openssl (CSR), Node `crypto` secp256k1 (pin DER vs IEEE-P1363).

## 6. CSR structure — captured from the oracle (2026-06-21, `-csr` on the example config)
`-csr` ran green on JDK 11.0.31 ("csr and private key have been generated successfully"). Decoded target
the engine's `crypto` module must reproduce (P0 target #4):
- **Subject DN:** `CN=<common.name>, O=<org.name>, OU=<org.unit.name>, C=SA` (e.g. `CN=TST-886431145-312345678900003`).
- **Key/sig:** EC **secp256k1**; CSR self-signed with **SHA256withECDSA**.
- **Extension `1.3.6.1.4.1.311.20.2`** (MS cert-template-name, non-critical) = UTF8String
  **`TSTZATCA-Code-Signing`** (sandbox). Prod/sim use `ZATCA-Code-Signing` / `PREZATCA-Code-Signing` — drive by `ZatcaEnvironment`.
- **Extension `2.5.29.17` SubjectAlternativeName** = a directoryName with:
  `2.5.4.15`(businessCategory)=industry, `2.5.4.26`(registeredAddress)=location, `2.5.4.12`(title `T`)=**invoice-type flags** (e.g. `1111`),
  `UID`(`0.9.2342.19200300.100.1.1`)=org/VAT identifier (15-digit), `2.5.4.4`(SURNAME)=**EGS serial** `1-<sol>|2-<model>|3-<uuid>`.
- CSR config fields (`Data/Input/csr-config-example.properties`): `csr.common.name`, `csr.serial.number`
  (`1-..|2-..|3-<uuid>`), `csr.organization.identifier` (VAT), `csr.organization.unit.name`,
  `csr.organization.name`, `csr.country.name`, `csr.invoice.type` (`1100`=standard,`0100`/etc), `csr.location.address`, `csr.industry.business.category`.
> NOTE: JDK keytool flags secp256k1 as "disabled" for cert ops — the SDK runs it via BouncyCastle, so our
> engine uses Node `crypto`/a BC-equivalent, not the JDK provider. (Keytool warning is cosmetic for decode.)
