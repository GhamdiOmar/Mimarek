/**
 * UBL 2.1 invoice builder for ZATCA — turns a structured document into the unsigned UBL XML that the
 * `xades` signer then signs. The emitted structure is the one proven to pass `fatoora -validate`
 * (XSD + EN16931 + KSA schematron) in the P0 spike.
 *
 * Scope: standard-rated (S, 15%) taxable supplies (commercial lease + 15% fees) — the only supplies that
 * get a ZATCA e-invoice (plan tax-scope). Exempt/zero-rated/out-of-scope supplies are non-VAT receipts
 * handled by the action layer, not here.
 */

const xmlEscape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (n: number): string => n.toFixed(2);
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ZatcaAddress {
  street: string;
  building: string;
  plot?: string;
  citySubdivision: string;
  city: string;
  postalZone: string;
  countrySubentity?: string;
}

export interface ZatcaParty {
  registrationName: string;
  /** 15-digit VAT number (required for a standard/B2B buyer; optional for a simplified/B2C buyer). */
  vatNumber?: string;
  /** Commercial Registration number (seller PartyIdentification scheme CRN). */
  crn?: string;
  address: ZatcaAddress;
}

export interface ZatcaLineItem {
  name: string;
  quantity: number;
  unitCode?: string;
  unitPrice: number;
  /** VAT percent (15 for standard-rated). */
  vatPercent: number;
}

export type ZatcaDocType = "invoice" | "credit-note" | "debit-note";

export interface ZatcaInvoiceInput {
  id: string;
  uuid: string;
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ss
  supplyDate?: string; // defaults to issueDate
  docType: ZatcaDocType;
  simplified?: boolean; // B2C → type-code name "02…", else standard "01…"
  icv: number | string; // invoice counter value
  pih: string; // previous invoice hash (base64); genesis for the first
  seller: ZatcaParty;
  buyer?: ZatcaParty;
  paymentMeansCode?: string; // default "10" (cash) — UNCL4461
  lines: ZatcaLineItem[];
  /** Original invoice number — required for credit/debit notes. */
  billingReferenceId?: string;
  /** Reason for issuance — credit/debit notes (PaymentMeans InstructionNote). */
  reason?: string;
  profileId?: string; // default "reporting:1.0"
}

const TYPE_CODE: Record<ZatcaDocType, string> = { invoice: "388", "credit-note": "381", "debit-note": "383" };

function addressXml(a: ZatcaAddress): string {
  return [
    `        <cbc:StreetName>${xmlEscape(a.street)}</cbc:StreetName>`,
    `        <cbc:BuildingNumber>${xmlEscape(a.building)}</cbc:BuildingNumber>`,
    a.plot ? `        <cbc:PlotIdentification>${xmlEscape(a.plot)}</cbc:PlotIdentification>` : null,
    `        <cbc:CitySubdivisionName>${xmlEscape(a.citySubdivision)}</cbc:CitySubdivisionName>`,
    `        <cbc:CityName>${xmlEscape(a.city)}</cbc:CityName>`,
    `        <cbc:PostalZone>${xmlEscape(a.postalZone)}</cbc:PostalZone>`,
    a.countrySubentity ? `        <cbc:CountrySubentity>${xmlEscape(a.countrySubentity)}</cbc:CountrySubentity>` : null,
    `        <cac:Country>`,
    `          <cbc:IdentificationCode>SA</cbc:IdentificationCode>`,
    `        </cac:Country>`,
  ].filter((l): l is string => l !== null).join("\n");
}

function supplierXml(p: ZatcaParty): string {
  return `  <cac:AccountingSupplierParty>
    <cac:Party>
${p.crn ? `      <cac:PartyIdentification>\n        <cbc:ID schemeID="CRN">${xmlEscape(p.crn)}</cbc:ID>\n      </cac:PartyIdentification>\n` : ""}      <cac:PostalAddress>
${addressXml(p.address)}
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xmlEscape(p.vatNumber ?? "")}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(p.registrationName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
}

function customerXml(p: ZatcaParty): string {
  return `  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
${addressXml(p.address)}
      </cac:PostalAddress>
${p.vatNumber ? `      <cac:PartyTaxScheme>\n        <cbc:CompanyID>${xmlEscape(p.vatNumber)}</cbc:CompanyID>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>\n        </cac:TaxScheme>\n      </cac:PartyTaxScheme>\n` : ""}      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(p.registrationName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

function lineXml(line: ZatcaLineItem, index: number): { xml: string; lineExt: number; vat: number } {
  const lineExt = round2(line.quantity * line.unitPrice);
  const vat = round2((lineExt * line.vatPercent) / 100);
  const xml = `  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${xmlEscape(line.unitCode ?? "PCE")}">${money(line.quantity)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="SAR">${money(lineExt)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="SAR">${money(vat)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="SAR">${money(round2(lineExt + vat))}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${xmlEscape(line.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${money(line.vatPercent)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="SAR">${money(line.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  return { xml, lineExt, vat };
}

/** Build an unsigned ZATCA UBL 2.1 invoice/credit-note/debit-note XML (standard-rated supplies). */
export function buildInvoice(input: ZatcaInvoiceInput): string {
  if (input.lines.length === 0) throw new Error("invoice requires at least one line");
  const nameFlag = `${input.simplified ? "02" : "01"}00000`;
  const supplyDate = input.supplyDate ?? input.issueDate;
  const vatPercent = input.lines[0]!.vatPercent;

  const built = input.lines.map((l, i) => lineXml(l, i));
  const taxable = round2(built.reduce((s, b) => s + b.lineExt, 0));
  const vatTotal = round2(built.reduce((s, b) => s + b.vat, 0));
  const inclusive = round2(taxable + vatTotal);

  const billingRef =
    input.docType !== "invoice" && input.billingReferenceId
      ? `  <cac:BillingReference>\n    <cac:InvoiceDocumentReference>\n      <cbc:ID>${xmlEscape(input.billingReferenceId)}</cbc:ID>\n    </cac:InvoiceDocumentReference>\n  </cac:BillingReference>\n`
      : "";
  const instructionNote = input.reason
    ? `\n    <cbc:InstructionNote>${xmlEscape(input.reason)}</cbc:InstructionNote>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>${xmlEscape(input.profileId ?? "reporting:1.0")}</cbc:ProfileID>
  <cbc:ID>${xmlEscape(input.id)}</cbc:ID>
  <cbc:UUID>${xmlEscape(input.uuid)}</cbc:UUID>
  <cbc:IssueDate>${input.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${input.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${nameFlag}">${TYPE_CODE[input.docType]}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
${billingRef}  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${xmlEscape(String(input.icv))}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${input.pih}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
${supplierXml(input.seller)}
${customerXml(input.buyer ?? input.seller)}
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${supplyDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${xmlEscape(input.paymentMeansCode ?? "10")}</cbc:PaymentMeansCode>${instructionNote}
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${money(vatTotal)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${money(vatTotal)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${money(taxable)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${money(vatTotal)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">S</cbc:ID>
        <cbc:Percent>${money(vatPercent)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${money(taxable)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${money(taxable)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${money(inclusive)}</cbc:TaxInclusiveAmount>
    <cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="SAR">${money(inclusive)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${built.map((b) => b.xml).join("\n")}
</Invoice>`;
}
