import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The headline R4 guarantee: EVERY money-movement action wires the issuance hook so no charge
 * silently skips a tenant document. This is a SOURCE-level assertion (no runtime import — the
 * actions transitively import @repo/zatca which the web vitest config doesn't resolve) that
 * locks the wiring: if a future edit drops a hook, this test goes red.
 */

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function fnBody(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`export async function ${name}`);
  const end = source.indexOf(`export async function ${nextName}`);
  expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
  return source.slice(start, end > start ? end : undefined);
}

describe("ZATCA Track C — every money-movement path issues a document (no silent skip)", () => {
  const installments = read("app/actions/installments.ts");
  const paymentPlans = read("app/actions/payment-plans.ts");

  it("H1 recordPayment issues a tenant document", () => {
    expect(fnBody(installments, "recordPayment", "bulkMarkInstallmentsPaid")).toContain("issueForChargeBestEffort");
  });

  it("H2 bulkMarkInstallmentsPaid issues each collected installment (maps over `applied`)", () => {
    const body = fnBody(installments, "bulkMarkInstallmentsPaid", "reverseRentPayment");
    expect(body).toContain("issueForChargeBestEffort");
    expect(body).toMatch(/applied\.map|of\s+applied/);
  });

  it("H3 reverseRentPayment issues a credit note", () => {
    expect(fnBody(installments, "reverseRentPayment", "markOverdueInstallments")).toContain(
      "issueCreditNoteForRentReversalBestEffort",
    );
  });

  it("H4 recordInstallmentPayment issues a tenant document", () => {
    expect(fnBody(paymentPlans, "recordInstallmentPayment", "getPaymentPlanSummary")).toContain("issueForChargeBestEffort");
  });

  it("hooks use the best-effort wrappers, never the throwing classifier directly (must not block the payment)", () => {
    expect(installments).not.toMatch(/await\s+issueDocumentForCharge\(/);
    expect(paymentPlans).not.toMatch(/await\s+issueDocumentForCharge\(/);
  });
});

describe("SEC-009 — ZATCA buyer snapshot uses the DECRYPTED customer address (no ciphertext at rest)", () => {
  const issuance = read("lib/zatca-issuance.ts");

  it("every buyerAddress write reads the decrypted buyerCustomer/customer, never the raw cx.customer", () => {
    // After SEC-009 the Customer.address is ciphertext at rest; persisting cx.customer.address
    // into TenantDocument.buyerAddress would store ciphertext and make toZatcaAddress() fall back
    // to a placeholder address. The buyerAddress snapshot must come from the decrypted copy.
    expect(issuance).not.toMatch(/buyerAddress:\s*\(cx\.customer/);
    expect(issuance).toMatch(/buyerAddress:\s*\(buyerCustomer\?\.address/);
  });

  it("decrypts the customer before building the ZATCA buyer party (both issuance sites)", () => {
    expect(issuance).toContain("decryptCustomerData(cx.customer)");
    expect(issuance).toContain("decryptCustomerData(doc.customer)");
  });
});
