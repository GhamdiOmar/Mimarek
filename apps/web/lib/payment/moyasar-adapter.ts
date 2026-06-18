/**
 * Moyasar Payment Gateway Adapter
 *
 * Implements PaymentProvider for Moyasar (https://moyasar.com).
 * - SAMA-licensed, PCI DSS Level 1
 * - Lowest Mada fees (1.5% + 1 SAR)
 * - First-class recurring billing with tokenization
 *
 * All amounts sent to Moyasar in halalas (minor units): 100.00 SAR = 10000
 */

import type {
  PaymentProvider,
  CreatePaymentRequest,
  CreatePaymentResponse,
  VerifyPaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  ChargeTokenRequest,
  ChargeTokenResponse,
  WebhookVerificationResult,
  NormalizedPaymentStatus,
  PaymentBrand,
  PaymentCurrency,
} from "./types";

// ─── Moyasar API Config ─────────────────────────────────────────────────────

const MOYASAR_API_BASE = "https://api.moyasar.com/v1";

/**
 * Minimal shape of a Moyasar payment object — only the fields this adapter
 * reads. Core fields (`id`, `status`, `amount`, `currency`) are always present
 * on a successful response (`moyasarFetch` throws on non-2xx); the optional
 * `source` fields are narrowed with `?.` and fall through to normalized
 * defaults. See https://docs.moyasar.com/payment-object.
 */
interface MoyasarPayment {
  id: string;
  status: string;
  amount: number;
  currency: PaymentCurrency;
  refunded?: number;
  updated_at?: string;
  source?: {
    transaction_url?: string;
    company?: string;
    number?: string;
    message?: string;
  };
}

function getApiKey(): string {
  const key = process.env.MOYASAR_API_KEY;
  if (!key) throw new Error("MOYASAR_API_KEY environment variable is not set");
  return key;
}

function getWebhookSecret(): string {
  const secret = process.env.MOYASAR_WEBHOOK_SECRET;
  if (!secret) throw new Error("MOYASAR_WEBHOOK_SECRET environment variable is not set");
  return secret;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Basic ${Buffer.from(getApiKey() + ":").toString("base64")}`,
    "Content-Type": "application/json",
  };
}

/** Convert SAR decimal to halalas (minor units) */
function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert halalas to SAR decimal */
function fromMinorUnits(amount: number): number {
  return amount / 100;
}

// ─── Status Mapping ─────────────────────────────────────────────────────────

function normalizeStatus(moyasarStatus: string): NormalizedPaymentStatus {
  const map: Record<string, NormalizedPaymentStatus> = {
    initiated: "pending",
    authorized: "authorized",
    paid: "captured",
    captured: "captured",
    failed: "failed",
    refunded: "refunded",
    voided: "voided",
  };
  return map[moyasarStatus] ?? "pending";
}

function normalizeBrand(source: string | undefined): PaymentBrand | undefined {
  if (!source) return undefined;
  const lower = source.toLowerCase();
  if (lower.includes("mada")) return "mada";
  if (lower.includes("visa")) return "visa";
  if (lower.includes("master")) return "mastercard";
  if (lower.includes("amex")) return "amex";
  if (lower.includes("apple")) return "applepay";
  if (lower.includes("stc")) return "stcpay";
  return undefined;
}

// ─── API Helper ─────────────────────────────────────────────────────────────

async function moyasarFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${MOYASAR_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const errMessage = data?.message || data?.errors?.[0]?.message || `Moyasar API error: ${res.status}`;
    throw new Error(errMessage);
  }

  return data as T;
}

// ─── Moyasar Adapter ────────────────────────────────────────────────────────

export const moyasarAdapter: PaymentProvider = {
  name: "moyasar",

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const body = {
      amount: toMinorUnits(request.amount),
      currency: request.currency,
      description: request.description,
      callback_url: request.callbackUrl,
      metadata: request.metadata,
      source: {
        type: "creditcard", // Will be overridden by Moyasar form on client
      },
    };

    const data = await moyasarFetch<MoyasarPayment>("/payments", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      transactionId: data.id,
      gatewayRef: data.id,
      paymentUrl: data.source?.transaction_url,
      status: normalizeStatus(data.status),
      rawResponse: data,
    };
  },

  async verifyPayment(gatewayRef: string): Promise<VerifyPaymentResponse> {
    const data = await moyasarFetch<MoyasarPayment>(`/payments/${gatewayRef}`);

    return {
      gatewayRef: data.id,
      status: normalizeStatus(data.status),
      amount: fromMinorUnits(data.amount),
      currency: data.currency,
      brand: normalizeBrand(data.source?.company),
      lastFourDigits: data.source?.number?.slice(-4),
      paidAt: data.updated_at ? new Date(data.updated_at) : undefined,
      failureReason: data.source?.message,
      rawResponse: data,
    };
  },

  async refundPayment(request: RefundPaymentRequest): Promise<RefundPaymentResponse> {
    const body: Record<string, unknown> = {};
    if (request.amount !== undefined) {
      body.amount = toMinorUnits(request.amount);
    }

    const data = await moyasarFetch<MoyasarPayment>(`/payments/${request.gatewayRef}/refund`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      refundId: data.id,
      status: normalizeStatus(data.status),
      refundedAmount: fromMinorUnits(data.refunded ?? data.amount),
      rawResponse: data,
    };
  },

  async chargeToken(request: ChargeTokenRequest): Promise<ChargeTokenResponse> {
    const body = {
      amount: toMinorUnits(request.amount),
      currency: request.currency,
      description: request.description,
      metadata: request.metadata,
      source: {
        type: "token",
        token: request.tokenId,
      },
    };

    const data = await moyasarFetch<MoyasarPayment>("/payments", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      transactionId: data.id,
      gatewayRef: data.id,
      status: normalizeStatus(data.status),
      failureReason: data.source?.message,
      rawResponse: data,
    };
  },

  async verifyWebhook(rawBody: string, signature: string): Promise<WebhookVerificationResult> {
    // Moyasar uses HMAC-SHA256 for webhook verification
    const crypto = await import("crypto");
    const secret = getWebhookSecret();
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    const sigBuf = Buffer.from(typeof signature === "string" ? signature : "");
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length === 0 || sigBuf.length !== expBuf.length) {
      return {
        valid: false,
        eventId: "",
        eventType: "",
        payload: null,
      };
    }

    let valid = false;
    try {
      valid = crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      valid = false;
    }

    const payload = JSON.parse(rawBody);

    return {
      valid,
      eventId: payload.id ?? payload.data?.id ?? "",
      eventType: payload.type ?? "",
      payload,
    };
  },
};
