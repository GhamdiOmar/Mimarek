/**
 * GA4 custom-event helper (CX-004).
 *
 * No-ops unless the user has granted Analytics consent: `window.gtag` is only
 * defined once `AnalyticsProvider` mounts, which ConsentProvider does ONLY after
 * consent (block-until-consent, PDPL). So a missing `gtag` === no consent → no-op.
 * Never throws — analytics must never break the app.
 *
 * Rules:
 *  - Numeric params must be raw numbers (Western digits), never formatted strings.
 *  - NEVER pass PII: no phone, email, name, or national ID. Only opaque ids,
 *    enums, and counts.
 */

type EventParams = Record<string, string | number | boolean | undefined>;

function gtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  return typeof fn === "function" ? fn : null;
}

/** Fire a GA4 event. Silent no-op without consent. */
export function trackEvent(name: string, params: EventParams = {}): void {
  const g = gtag();
  if (!g) return;
  try {
    g("event", name, params);
  } catch {
    /* analytics must never break the app */
  }
}

/**
 * Associate the session with an opaque user + org (no PII). Safe to call on
 * every dashboard mount; no-ops until consent is granted.
 */
export function identify(opts: {
  userId: string;
  orgId?: string | null;
  role?: string;
  plan?: string;
}): void {
  const g = gtag();
  if (!g) return;
  try {
    g("set", {
      user_id: opts.userId, // cuid — opaque, not PII
      org_id: opts.orgId ?? undefined,
      user_role: opts.role,
      org_plan: opts.plan,
    });
  } catch {
    /* no-op */
  }
}

/** Canonical funnel event names — import these, don't hand-type strings. */
export const AnalyticsEvent = {
  CustomerCreated: "customer_created",
  ReservationCreated: "reservation_created",
  ReservationConfirmed: "reservation_confirmed",
  ContractCreated: "contract_created",
  ContractSigned: "contract_signed",
  PaymentRecorded: "payment_recorded",
  MaintenanceTicketCreated: "maintenance_ticket_created",
  SearchPerformed: "search_performed",
  ExportPerformed: "export_performed",
  OnboardingStepCompleted: "onboarding_step_completed",
} as const;
