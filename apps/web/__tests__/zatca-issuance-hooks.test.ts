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
