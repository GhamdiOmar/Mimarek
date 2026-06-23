import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Behavioral coverage for the R4b reporting recovery sweep + health metric. The SUT transitively
 * imports @repo/zatca (unresolvable in the web vitest env), so we mock the two seams it touches —
 * `@repo/db` and `./zatca-issuance` — BEFORE importing it. This exercises the real tally / skip /
 * error-isolation logic that the source-string test cannot.
 */

const clearMock = vi.fn();
vi.mock("../lib/zatca-issuance", () => ({
  clearTenantDocumentInternal: (...args: unknown[]) => clearMock(...args),
}));

const findManyMock = vi.fn();
const groupByMock = vi.fn();
const countMock = vi.fn();
vi.mock("@repo/db", () => ({
  db: {
    tenantDocument: {
      findMany: (...a: unknown[]) => findManyMock(...a),
      groupBy: (...a: unknown[]) => groupByMock(...a),
      count: (...a: unknown[]) => countMock(...a),
    },
  },
}));

import { runReportingSweepInternal, getReportingHealthInternal } from "../lib/zatca-reporting";

describe("runReportingSweepInternal — behavior", () => {
  beforeEach(() => {
    clearMock.mockReset();
    findManyMock.mockReset();
  });

  it("re-submits each parked document with isRetry and tallies every outcome", async () => {
    findManyMock.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
    clearMock
      .mockResolvedValueOnce({ outcome: "REPORTED" })
      .mockResolvedValueOnce({ outcome: "CLEARED" })
      .mockResolvedValueOnce({ outcome: "TRANSPORT_ERROR" })
      .mockResolvedValueOnce({ outcome: "REJECTED" });

    const r = await runReportingSweepInternal();

    expect(r).toEqual({ scanned: 4, reported: 1, cleared: 1, stillPending: 1, rejected: 1, errors: 0 });
    expect(clearMock).toHaveBeenCalledWith("a", { isRetry: true });
    expect(clearMock).toHaveBeenCalledTimes(4);
  });

  it("isolates a thrown document as an error without aborting the rest of the batch", async () => {
    findManyMock.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    clearMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ outcome: "REPORTED" })
      .mockResolvedValueOnce({ outcome: "REPORTED" });

    const r = await runReportingSweepInternal();

    expect(r.scanned).toBe(3);
    expect(r.errors).toBe(1);
    expect(r.reported).toBe(2);
    expect(clearMock).toHaveBeenCalledTimes(3);
  });

  it("queries only parked docs (PENDING, not RECEIPT, with a stored payload), bounded", async () => {
    findManyMock.mockResolvedValue([]);
    await runReportingSweepInternal();
    const arg = findManyMock.mock.calls[0]![0];
    expect(arg.where.zatcaStatus).toBe("PENDING");
    expect(arg.where.documentType).toEqual({ not: "RECEIPT" });
    expect(arg.where.xmlContent).toEqual({ not: null });
    expect(arg.take).toBeGreaterThan(0);
  });
});

describe("getReportingHealthInternal — behavior", () => {
  beforeEach(() => {
    groupByMock.mockReset();
    countMock.mockReset();
  });

  it("maps the lifecycle counts + held + stuck>12h", async () => {
    groupByMock.mockResolvedValue([
      { zatcaStatus: "CLEARED", _count: { _all: 5 } },
      { zatcaStatus: "REPORTED", _count: { _all: 3 } },
      { zatcaStatus: "PENDING", _count: { _all: 2 } },
      { zatcaStatus: "REJECTED", _count: { _all: 1 } },
    ]);
    countMock.mockResolvedValueOnce(4); // needsBuyerData (held)
    countMock.mockResolvedValueOnce(1); // stuck > 12h

    const h = await getReportingHealthInternal("org-1");

    expect(h).toEqual({ cleared: 5, reported: 3, pending: 2, rejected: 1, held: 4, stuckOver12h: 1 });
    // org-scoped when an org id is passed
    expect(groupByMock.mock.calls[0]![0].where).toEqual({ organizationId: "org-1" });
  });

  it("is platform-wide (no org filter) when organizationId is null", async () => {
    groupByMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    await getReportingHealthInternal(null);
    expect(groupByMock.mock.calls[0]![0].where).toEqual({});
  });
});
