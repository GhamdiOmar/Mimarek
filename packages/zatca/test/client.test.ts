// cspell:ignore Hhtb NEWTOK NEWSEC FQVJFRA — base64 test-fixture fragments, not real words
import { describe, it, expect } from "vitest";
import { createZatcaClient, ZatcaError, type ZatcaCredentials } from "../src/index.js";

// ─── fetch mock harness (no network) ────────────────────────────────────────────
type MockResp = { status: number; json?: unknown; text?: string } | { error: Error };

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

function makeFetch(queue: MockResp[]) {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined;
    calls.push({ url: String(url), method: String(init?.method ?? "GET"), headers, body });
    const next = queue.shift();
    if (!next) throw new Error("no mock response queued");
    if ("error" in next) throw next.error;
    const payload = next.text ?? (next.json !== undefined ? JSON.stringify(next.json) : "");
    return new Response(payload, { status: next.status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function makeClient(queue: MockResp[]) {
  const { fetchImpl, calls } = makeFetch(queue);
  return { client: createZatcaClient({ environment: "SANDBOX", fetchImpl }), calls };
}

const CREDS: ZatcaCredentials = { binarySecurityToken: "TOKEN123", secret: "SECRET456" };
const PAYLOAD = { invoiceHash: "HASH==", uuid: "uuid-1", invoiceXmlBase64: "PHhtbD4=" };
const SANDBOX = "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal";

const CSID_BODY = { requestID: 999, dispositionMessage: "ISSUED", binarySecurityToken: "NEWTOK", secret: "NEWSEC" };

describe("createZatcaClient — compliance CSID", () => {
  it("POSTs the CSR base64 with an OTP header and parses the CSID", async () => {
    const { client, calls } = makeClient([{ status: 200, json: CSID_BODY }]);
    const res = await client.requestComplianceCsid({ csrPem: "-----BEGIN CERTIFICATE REQUEST-----\nAA\n", otp: "123456" });

    expect(res).toEqual({ requestId: 999, binarySecurityToken: "NEWTOK", secret: "NEWSEC", dispositionMessage: "ISSUED" });
    const call = calls[0]!;
    expect(call.url).toBe(`${SANDBOX}/compliance`);
    expect(call.method).toBe("POST");
    expect(call.headers["OTP"]).toBe("123456");
    expect(call.headers["Accept-Version"]).toBe("V2");
    expect(call.headers["Authorization"]).toBeUndefined();
    expect(call.body?.csr).toBe(Buffer.from("-----BEGIN CERTIFICATE REQUEST-----\nAA\n", "utf8").toString("base64"));
  });

  it("throws config (no request sent) when CSR or OTP is missing", async () => {
    const { client, calls } = makeClient([]);
    await expect(client.requestComplianceCsid({ csrPem: "", otp: "1" })).rejects.toMatchObject({ kind: "config" });
    await expect(client.requestComplianceCsid({ csrPem: "x", otp: "" })).rejects.toMatchObject({ kind: "config" });
    expect(calls).toHaveLength(0);
  });

  it("maps a 400 with error messages to a business error carrying the codes", async () => {
    const { client } = makeClient([
      { status: 400, json: { validationResults: { errorMessages: [{ code: "BR-KSA-01", message: "bad" }] } } },
    ]);
    const err = await client.requestComplianceCsid({ csrPem: "x", otp: "1" }).catch((e) => e);
    expect(err).toBeInstanceOf(ZatcaError);
    expect(err.kind).toBe("business");
    expect(err.codes).toEqual(["BR-KSA-01"]);
    expect(err.isRetryable).toBe(false);
  });
});

describe("createZatcaClient — production CSID", () => {
  it("POSTs compliance_request_id with Basic auth and parses the PCSID", async () => {
    const { client, calls } = makeClient([{ status: 200, json: CSID_BODY }]);
    const res = await client.requestProductionCsid({ credentials: CREDS, complianceRequestId: 999 });

    expect(res.binarySecurityToken).toBe("NEWTOK");
    const call = calls[0]!;
    expect(call.url).toBe(`${SANDBOX}/production/csids`);
    expect(call.body).toEqual({ compliance_request_id: 999 });
    expect(call.headers["Authorization"]).toBe(`Basic ${Buffer.from("TOKEN123:SECRET456").toString("base64")}`);
  });

  it("throws config when credentials are missing", async () => {
    const { client, calls } = makeClient([]);
    await expect(
      client.requestProductionCsid({ credentials: { binarySecurityToken: "", secret: "" }, complianceRequestId: 1 }),
    ).rejects.toMatchObject({ kind: "config" });
    expect(calls).toHaveLength(0);
  });

  it("maps a 400 to a business error", async () => {
    const { client } = makeClient([
      { status: 400, json: { validationResults: { errorMessages: [{ code: "E1", message: "x" }] } } },
    ]);
    await expect(
      client.requestProductionCsid({ credentials: CREDS, complianceRequestId: 1 }),
    ).rejects.toMatchObject({ kind: "business" });
  });

  it("throws business when a 200 body is non-JSON / missing the token", async () => {
    const { client } = makeClient([{ status: 200, text: "<html>not json</html>" }]);
    await expect(
      client.requestProductionCsid({ credentials: CREDS, complianceRequestId: 1 }),
    ).rejects.toMatchObject({ kind: "business" });
  });
});

describe("createZatcaClient — clearance (standard / B2B)", () => {
  it("clears with Clearance-Status 1 and returns the cleared XML", async () => {
    const { client, calls } = makeClient([
      { status: 200, json: { clearanceStatus: "CLEARED", clearedInvoice: "Q0xFQVJFRA==", validationResults: { status: "PASS" } } },
    ]);
    const res = await client.clearInvoice({ credentials: CREDS, payload: PAYLOAD });

    expect(res.outcome).toBe("CLEARED");
    expect(res.clearedInvoiceBase64).toBe("Q0xFQVJFRA==");
    const call = calls[0]!;
    expect(call.url).toBe(`${SANDBOX}/invoices/clearance/single`);
    expect(call.headers["Clearance-Status"]).toBe("1");
    expect(call.body).toEqual({ invoiceHash: "HASH==", uuid: "uuid-1", invoice: "PHhtbD4=" });
  });

  it("maps a 202 / warnings response to CLEARED_WITH_WARNINGS", async () => {
    const { client } = makeClient([
      { status: 202, json: { clearanceStatus: "CLEARED", clearedInvoice: "WA==", validationResults: { warningMessages: [{ code: "BR-KSA-37", message: "w" }], status: "WARNING" } } },
    ]);
    const res = await client.clearInvoice({ credentials: CREDS, payload: PAYLOAD });
    expect(res.outcome).toBe("CLEARED_WITH_WARNINGS");
  });

  it("treats NOT_CLEARED on a 200 as a business rejection", async () => {
    const { client } = makeClient([
      { status: 200, json: { clearanceStatus: "NOT_CLEARED", validationResults: { errorMessages: [{ code: "BR-KSA-99", message: "no" }] } } },
    ]);
    const err = await client.clearInvoice({ credentials: CREDS, payload: PAYLOAD }).catch((e) => e);
    expect(err).toBeInstanceOf(ZatcaError);
    expect(err.kind).toBe("business");
    expect(err.codes).toContain("BR-KSA-99");
  });

  it("maps a 500 to a retryable transport error", async () => {
    const { client } = makeClient([{ status: 500, text: "gateway boom" }]);
    const err = await client.clearInvoice({ credentials: CREDS, payload: PAYLOAD }).catch((e) => e);
    expect(err.kind).toBe("transport");
    expect(err.isRetryable).toBe(true);
    expect(err.message).not.toContain("PHhtbD4="); // D13: no payload echoed
  });

  it("maps a 401 to a config error", async () => {
    const { client } = makeClient([{ status: 401, text: "" }]);
    await expect(client.clearInvoice({ credentials: CREDS, payload: PAYLOAD })).rejects.toMatchObject({ kind: "config" });
  });

  it("maps a thrown network error to transport", async () => {
    const { client } = makeClient([{ error: new TypeError("fetch failed") }]);
    const err = await client.clearInvoice({ credentials: CREDS, payload: PAYLOAD }).catch((e) => e);
    expect(err.kind).toBe("transport");
  });

  it("throws config when the payload is incomplete", async () => {
    const { client, calls } = makeClient([]);
    await expect(
      client.clearInvoice({ credentials: CREDS, payload: { invoiceHash: "", uuid: "u", invoiceXmlBase64: "x" } }),
    ).rejects.toMatchObject({ kind: "config" });
    expect(calls).toHaveLength(0);
  });
});

describe("createZatcaClient — reporting (simplified / B2C)", () => {
  it("reports with Clearance-Status 0 and returns REPORTED with no cleared XML", async () => {
    const { client, calls } = makeClient([{ status: 200, json: { reportingStatus: "REPORTED", validationResults: { status: "PASS" } } }]);
    const res = await client.reportInvoice({ credentials: CREDS, payload: PAYLOAD });

    expect(res.outcome).toBe("REPORTED");
    expect(res.clearedInvoiceBase64).toBeNull();
    expect(calls[0]!.url).toBe(`${SANDBOX}/invoices/reporting/single`);
    expect(calls[0]!.headers["Clearance-Status"]).toBe("0");
  });

  it("treats NOT_REPORTED as a business rejection", async () => {
    const { client } = makeClient([{ status: 200, json: { reportingStatus: "NOT_REPORTED", validationResults: { errorMessages: [{ code: "X", message: "m" }] } } }]);
    await expect(client.reportInvoice({ credentials: CREDS, payload: PAYLOAD })).rejects.toMatchObject({ kind: "business" });
  });
});

describe("createZatcaClient — compliance invoice check", () => {
  it("mirrors the document type: reportingStatus → REPORTED", async () => {
    const { client } = makeClient([{ status: 200, json: { reportingStatus: "REPORTED", validationResults: { status: "PASS" } } }]);
    const res = await client.checkComplianceInvoice({ credentials: CREDS, payload: PAYLOAD });
    expect(res.outcome).toBe("REPORTED");
    expect(res.clearedInvoiceBase64).toBeNull();
  });

  it("mirrors the document type: clearanceStatus → CLEARED", async () => {
    const { client, calls } = makeClient([{ status: 200, json: { clearanceStatus: "CLEARED", validationResults: { status: "PASS" } } }]);
    const res = await client.checkComplianceInvoice({ credentials: CREDS, payload: PAYLOAD });
    expect(res.outcome).toBe("CLEARED");
    expect(calls[0]!.url).toBe(`${SANDBOX}/compliance/invoices`);
  });
});

describe("createZatcaClient — timeout wiring", () => {
  it("aborts after timeoutMs and raises a transport error", async () => {
    const fetchImpl = ((_url: string | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      })) as unknown as typeof fetch;
    const client = createZatcaClient({ environment: "SANDBOX", fetchImpl, timeoutMs: 30 });
    const err = await client.clearInvoice({ credentials: CREDS, payload: PAYLOAD }).catch((e) => e);
    expect(err).toBeInstanceOf(ZatcaError);
    expect(err.kind).toBe("transport");
    expect(err.message).toMatch(/timed out/);
  });
});
