import { ZatcaError, type ZatcaClearanceOutcome, type ZatcaEnvironment } from "./index.js";

/**
 * ZATCA Fatoora REST client — the network layer of the engine (plan §5.2).
 *
 * A small, typed `fetch` wrapper over the ZATCA Phase-2 API:
 *   - compliance CSID issuance (CSR + OTP → CCSID + secret),
 *   - compliance invoice check,
 *   - production CSID issuance,
 *   - clearance (standard / B2B, real-time, returns the cleared XML),
 *   - reporting (simplified / B2C, ≤24h notify).
 *
 * It does NO crypto and NO XML building — callers pass an already-signed invoice (`buildInvoice` →
 * `signInvoice`) plus its `invoiceHash`/`uuid`. Failures map onto the discriminated {@link ZatcaError}
 * (plan D22) so the action layer can decide retry-vs-resubmit:
 *   - `transport` → outcome uncertain; re-POST the SAME payload (idempotent: same hash/UUID/ICV).
 *   - `business`  → ZATCA rejected it; correct and resubmit as a NEW document (new hash/UUID/ICV/time).
 *   - `config`    → local misconfiguration (missing CSR/OTP/credentials); never submitted.
 *
 * Error messages carry NO request payload or key material (plan D13) — only HTTP status + ZATCA's own
 * validation codes/messages.
 *
 * Endpoint paths, headers, auth scheme and body shapes were cross-checked against multiple reference
 * clients AND verified against the live SANDBOX `/compliance` endpoint (HTTP 200, `ISSUED`).
 */

// ─── Environment base URLs (host shared; only the path segment differs) ─────────
// SANDBOX/developer-portal verified live; SIMULATION/PRODUCTION per ZATCA reference clients.
const BASE_URLS: Record<ZatcaEnvironment, string> = {
  SANDBOX: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
  SIMULATION: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
  PRODUCTION: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
};

const ACCEPT_VERSION = "V2";
const DEFAULT_TIMEOUT_MS = 30_000;

// ─── Public types ───────────────────────────────────────────────────────────────

/** Credentials returned by a CSID call; used verbatim for HTTP Basic auth on subsequent calls. */
export interface ZatcaCredentials {
  /** The `binarySecurityToken` from a compliance/production CSID response — used AS-IS (already base64). */
  binarySecurityToken: string;
  /** The paired API secret from the same response. */
  secret: string;
}

/** Result of a compliance or production CSID request. */
export interface ZatcaCsidResult {
  requestId: number;
  binarySecurityToken: string;
  secret: string;
  dispositionMessage?: string;
}

/** A signed document ready for submission. */
export interface ZatcaInvoicePayload {
  /** base64 SHA-256 invoice hash (as produced by `computeInvoiceHash`). */
  invoiceHash: string;
  /** The UBL `cbc:UUID`. */
  uuid: string;
  /** base64 of the signed UBL XML bytes. */
  invoiceXmlBase64: string;
}

/** One entry from a ZATCA `validationResults` messages array. */
export interface ZatcaValidationMessage {
  type: string;
  code: string;
  category: string;
  message: string;
  status: string;
}

/** The `validationResults` envelope returned by clearance / reporting / compliance-check. */
export interface ZatcaValidationResults {
  infoMessages: ZatcaValidationMessage[];
  warningMessages: ZatcaValidationMessage[];
  errorMessages: ZatcaValidationMessage[];
  status?: string;
}

/** The success subset of {@link ZatcaClearanceOutcome} a submission can return (failures throw). */
export type ZatcaSubmissionOutcome = Extract<
  ZatcaClearanceOutcome,
  "CLEARED" | "CLEARED_WITH_WARNINGS" | "REPORTED"
>;

/** Result of a successful clearance / reporting / compliance-check submission. */
export interface ZatcaSubmissionResult {
  outcome: ZatcaSubmissionOutcome;
  /** The ZATCA-stamped cleared XML (base64) — clearance only; `null` for reporting. */
  clearedInvoiceBase64: string | null;
  validationResults: ZatcaValidationResults;
}

export interface ZatcaClientOptions {
  environment: ZatcaEnvironment;
  /** Override the base URL (tests / future endpoint changes). Defaults to the environment base. */
  baseUrl?: string;
  /** Inject a `fetch` implementation (tests). Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** `Accept-Language` header. Defaults to `"en"`. */
  acceptLanguage?: "en" | "ar";
  /** Per-request timeout in ms. Defaults to 30 000. */
  timeoutMs?: number;
}

export interface ZatcaClient {
  requestComplianceCsid(input: { csrPem: string; otp: string }): Promise<ZatcaCsidResult>;
  checkComplianceInvoice(input: {
    credentials: ZatcaCredentials;
    payload: ZatcaInvoicePayload;
  }): Promise<ZatcaSubmissionResult>;
  requestProductionCsid(input: {
    credentials: ZatcaCredentials;
    complianceRequestId: number | string;
  }): Promise<ZatcaCsidResult>;
  clearInvoice(input: {
    credentials: ZatcaCredentials;
    payload: ZatcaInvoicePayload;
  }): Promise<ZatcaSubmissionResult>;
  reportInvoice(input: {
    credentials: ZatcaCredentials;
    payload: ZatcaInvoicePayload;
  }): Promise<ZatcaSubmissionResult>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

const codesOf = (r: ZatcaValidationResults): string[] => r.errorMessages.map((m) => m.code).filter(Boolean);

function basicAuth(c: ZatcaCredentials): string {
  return `Basic ${Buffer.from(`${c.binarySecurityToken}:${c.secret}`).toString("base64")}`;
}

function requireCredentials(c: ZatcaCredentials | undefined): asserts c is ZatcaCredentials {
  if (!c || !c.binarySecurityToken?.trim() || !c.secret?.trim()) {
    throw new ZatcaError("config", "Valid ZATCA credentials (security token + secret) are required.");
  }
}

function requirePayload(p: ZatcaInvoicePayload | undefined): asserts p is ZatcaInvoicePayload {
  if (!p || !p.invoiceHash?.trim() || !p.uuid?.trim() || !p.invoiceXmlBase64?.trim()) {
    throw new ZatcaError("config", "A signed invoice payload (hash, uuid, invoice) is required.");
  }
}

function asMessages(arr: unknown): ZatcaValidationMessage[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => {
    const o = (m ?? {}) as Json;
    return {
      type: String(o.type ?? ""),
      code: String(o.code ?? ""),
      category: String(o.category ?? ""),
      message: String(o.message ?? ""),
      status: String(o.status ?? ""),
    };
  });
}

function parseResults(body: Json): ZatcaValidationResults {
  const vr = (body.validationResults ?? {}) as Json;
  return {
    infoMessages: asMessages(vr.infoMessages),
    warningMessages: asMessages(vr.warningMessages),
    errorMessages: asMessages(vr.errorMessages),
    status: vr.status === undefined ? undefined : String(vr.status),
  };
}

function parseCsid(json: Json): ZatcaCsidResult {
  const token = json.binarySecurityToken;
  const secret = json.secret;
  if (typeof token !== "string" || typeof secret !== "string") {
    throw new ZatcaError("business", "ZATCA did not return a CSID (missing security token or secret).");
  }
  const rawId = json.requestID;
  return {
    requestId: typeof rawId === "number" ? rawId : Number(rawId ?? 0),
    binarySecurityToken: token,
    secret,
    dispositionMessage: json.dispositionMessage === undefined ? undefined : String(json.dispositionMessage),
  };
}

function summarizeRejection(status: number, results: ZatcaValidationResults): string {
  const n = results.errorMessages.length;
  const first = results.errorMessages[0]?.message;
  if (n > 0) {
    return `ZATCA rejected the document (HTTP ${status}, ${n} error${n === 1 ? "" : "s"})${first ? `: ${first}` : ""}.`;
  }
  return `ZATCA rejected the document (HTTP ${status}).`;
}

/** Map a non-2xx HTTP status to a typed {@link ZatcaError} (plan D22). */
function classifyHttpError(status: number, results: ZatcaValidationResults): ZatcaError {
  // Technical / server-side → outcome uncertain → re-POST the SAME payload (D22a).
  if (status === 429 || status === 413 || status >= 500) {
    return new ZatcaError("transport", `ZATCA gateway returned a temporary error (HTTP ${status}).`);
  }
  // Bad credentials → local misconfiguration; never silently retried.
  if (status === 401 || status === 403) {
    return new ZatcaError("config", `ZATCA rejected the credentials (HTTP ${status}).`);
  }
  // 400 / 303 / other 4xx → business rejection → correct & resubmit as a NEW document (D22b).
  return new ZatcaError("business", summarizeRejection(status, results), codesOf(results));
}

function toSubmissionResult(
  status: number,
  json: Json,
  results: ZatcaValidationResults,
  kind: "clearance" | "reporting" | "compliance",
): ZatcaSubmissionResult {
  const clearanceStatus = typeof json.clearanceStatus === "string" ? json.clearanceStatus : undefined;
  const reportingStatus = typeof json.reportingStatus === "string" ? json.reportingStatus : undefined;
  const clearedInvoiceBase64 = typeof json.clearedInvoice === "string" ? json.clearedInvoice : null;

  // A 2xx body can still carry a rejection (NOT_CLEARED/NOT_REPORTED or error messages) → business error.
  if (
    clearanceStatus === "NOT_CLEARED" ||
    reportingStatus === "NOT_REPORTED" ||
    results.errorMessages.length > 0
  ) {
    throw new ZatcaError("business", summarizeRejection(status, results), codesOf(results));
  }

  const hasWarnings = status === 202 || results.warningMessages.length > 0 || results.status === "WARNING";

  let outcome: ZatcaSubmissionOutcome;
  if (kind === "reporting" || (kind === "compliance" && reportingStatus)) {
    outcome = "REPORTED";
  } else {
    outcome = hasWarnings ? "CLEARED_WITH_WARNINGS" : "CLEARED";
  }

  return { outcome, clearedInvoiceBase64, validationResults: results };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a ZATCA Fatoora REST client bound to an environment. */
export function createZatcaClient(options: ZatcaClientOptions): ZatcaClient {
  const base = (options.baseUrl ?? BASE_URLS[options.environment]).replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const language = options.acceptLanguage ?? "en";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (typeof fetchImpl !== "function") {
    throw new ZatcaError("config", "No fetch implementation available for the ZATCA client.");
  }

  const jsonHeaders = (): Record<string, string> => ({
    "Accept-Version": ACCEPT_VERSION,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Language": language,
  });

  async function request(
    path: string,
    headers: Record<string, string>,
    body: Json,
  ): Promise<{ status: number; json: Json }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      // Network failure / abort → outcome uncertain (D22a). No payload echoed (D13).
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new ZatcaError(
        "transport",
        aborted
          ? `ZATCA request timed out after ${timeoutMs}ms.`
          : "ZATCA request failed to reach the gateway.",
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: Json = {};
    if (text) {
      try {
        json = JSON.parse(text) as Json;
      } catch {
        // Non-JSON body — keep `json` empty; status drives classification below.
        json = {};
      }
    }
    return { status: res.status, json };
  }

  return {
    async requestComplianceCsid({ csrPem, otp }) {
      if (!csrPem?.trim()) throw new ZatcaError("config", "A CSR is required to request a compliance CSID.");
      if (!otp?.trim()) throw new ZatcaError("config", "An OTP is required to request a compliance CSID.");
      const { status, json } = await request(
        "/compliance",
        { ...jsonHeaders(), OTP: otp },
        { csr: Buffer.from(csrPem, "utf8").toString("base64") },
      );
      if (status !== 200 && status !== 202) throw classifyHttpError(status, parseResults(json));
      return parseCsid(json);
    },

    async requestProductionCsid({ credentials, complianceRequestId }) {
      requireCredentials(credentials);
      if (complianceRequestId === undefined || complianceRequestId === null || `${complianceRequestId}` === "") {
        throw new ZatcaError("config", "A compliance request id is required to request a production CSID.");
      }
      const { status, json } = await request(
        "/production/csids",
        { ...jsonHeaders(), Authorization: basicAuth(credentials) },
        { compliance_request_id: complianceRequestId },
      );
      if (status !== 200 && status !== 202) throw classifyHttpError(status, parseResults(json));
      return parseCsid(json);
    },

    async checkComplianceInvoice({ credentials, payload }) {
      requireCredentials(credentials);
      requirePayload(payload);
      const { status, json } = await request(
        "/compliance/invoices",
        { ...jsonHeaders(), Authorization: basicAuth(credentials) },
        { invoiceHash: payload.invoiceHash, uuid: payload.uuid, invoice: payload.invoiceXmlBase64 },
      );
      const results = parseResults(json);
      if (status !== 200 && status !== 202) throw classifyHttpError(status, results);
      return toSubmissionResult(status, json, results, "compliance");
    },

    async clearInvoice({ credentials, payload }) {
      requireCredentials(credentials);
      requirePayload(payload);
      const { status, json } = await request(
        "/invoices/clearance/single",
        { ...jsonHeaders(), Authorization: basicAuth(credentials), "Clearance-Status": "1" },
        { invoiceHash: payload.invoiceHash, uuid: payload.uuid, invoice: payload.invoiceXmlBase64 },
      );
      const results = parseResults(json);
      if (status !== 200 && status !== 202) throw classifyHttpError(status, results);
      return toSubmissionResult(status, json, results, "clearance");
    },

    async reportInvoice({ credentials, payload }) {
      requireCredentials(credentials);
      requirePayload(payload);
      const { status, json } = await request(
        "/invoices/reporting/single",
        { ...jsonHeaders(), Authorization: basicAuth(credentials), "Clearance-Status": "0" },
        { invoiceHash: payload.invoiceHash, uuid: payload.uuid, invoice: payload.invoiceXmlBase64 },
      );
      const results = parseResults(json);
      if (status !== 200 && status !== 202) throw classifyHttpError(status, results);
      return toSubmissionResult(status, json, results, "reporting");
    },
  };
}
