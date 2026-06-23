import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * R4b — the B2C reporting RECOVERY sweep. Source-level assertions (the modules transitively
 * import @repo/zatca, which the web vitest config doesn't resolve) that lock:
 *   1. the sweep re-submits exactly the parked documents, idempotently;
 *   2. the cron route runs it behind the cron secret only;
 *   3. the admin action guards `zatca:admin` + raises the >12h stuck alarm;
 *   4. the health metric reads TenantDocument (not the platform Invoice) + the 12h threshold.
 */

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("ZATCA R4b — reporting recovery sweep", () => {
  const lib = read("lib/zatca-reporting.ts");
  const cron = read("app/api/cron/zatca-report/route.ts");
  const action = read("app/actions/zatca/reporting-sweep.ts");

  it("sweeps only parked documents (PENDING, not RECEIPT, with a stored payload)", () => {
    expect(lib).toContain('zatcaStatus: "PENDING"');
    expect(lib).toMatch(/documentType:\s*\{\s*not:\s*"RECEIPT"\s*\}/);
    expect(lib).toMatch(/xmlContent:\s*\{\s*not:\s*null\s*\}/);
  });

  it("re-submits each parked document idempotently (isRetry, reusing the stored payload)", () => {
    expect(lib).toMatch(/clearTenantDocumentInternal\([^)]*\{\s*isRetry:\s*true\s*\}/);
  });

  it("tallies every terminal outcome (reported / cleared / rejected / still-pending)", () => {
    expect(lib).toContain("REPORTED");
    expect(lib).toContain("CLEARED");
    expect(lib).toContain("REJECTED");
    expect(lib).toMatch(/stillPending/);
  });

  it("health metric reads TenantDocument (tenant docs), not the platform Invoice", () => {
    expect(lib).toMatch(/db\.tenantDocument\.(groupBy|count)/);
    expect(lib).not.toMatch(/db\.invoice\./);
  });

  it("flags the >12h stuck-reporting condition off zatcaSubmittedAt", () => {
    expect(lib).toContain("STUCK_HOURS");
    expect(lib).toMatch(/STUCK_HOURS\s*=\s*12/);
    expect(lib).toMatch(/zatcaSubmittedAt:\s*\{\s*lt:/);
  });

  it("counts HELD documents via needsBuyerData", () => {
    expect(lib).toMatch(/needsBuyerData:\s*true/);
  });

  it("cron route runs the sweep behind the cron secret only (never tenant-reachable)", () => {
    expect(cron).toContain("isAuthorizedCronRequest");
    expect(cron).toContain("runReportingSweepInternal");
  });

  it("admin action guards zatca:admin and raises the stuck alarm to platform staff", () => {
    expect(action).toMatch(/requirePermission\("zatca:admin"\)/);
    expect(action).toContain("notifyPlatformStaff");
    expect(action).toMatch(/stuckOver12h\s*>\s*0/);
  });
});
