/**
 * Session-inactivity-timeout Phase 1 (client-side idle guard) — role-based
 * defaults per `future-plans/session-inactivity-timeout-gap-action-plan.md`
 * (IDLE-012: constants first, promote to system config later if needed).
 *
 * This is a browser-side privacy control only. It never mutates
 * `tokenVersion` (that revokes every device — see AGENTS.md § "Critical
 * Development Rules") and never changes the 7-day JWT `maxAge`.
 */

export const IDLE_TIMEOUT_MINUTES_BY_ROLE: Record<string, number> = {
  SYSTEM_ADMIN: 15,
  SYSTEM_SUPPORT: 15,
  ADMIN: 30,
  MANAGER: 30,
  FINANCE: 30,
  AGENT: 45,
  LEASING: 45,
  TECHNICIAN: 45,
  USER: 60,
};

/** Warning window before timeout, in minutes — same for every role. */
export const IDLE_WARNING_MINUTES = 2;

/**
 * Most-restrictive tier — the fail-SECURE fallback for any role not in the map.
 * A newly-added or misspelled role must never silently inherit the longest,
 * least-safe idle window; it gets the strictest one instead.
 */
export const IDLE_TIMEOUT_MINUTES_STRICTEST = 15;

/**
 * Resolve the idle timeout (minutes) for a role. An unmapped/unknown/undefined
 * role fails SECURE — it falls to the strictest (15-min) tier, never the
 * longest. On the dashboard/portal the session always carries a real role, so
 * this fallback only bites a genuinely unrecognized role.
 */
export function getIdleTimeoutMinutes(role: string | undefined): number {
  // Own-key guard, not `in`/bracket access: `obj["toString"]` traverses the
  // prototype chain, so a role literally named "toString"/"constructor" must
  // not resolve to an inherited member. `typeof` also satisfies the strict
  // `noUncheckedIndexedAccess` index type (number | undefined → number).
  if (role && Object.prototype.hasOwnProperty.call(IDLE_TIMEOUT_MINUTES_BY_ROLE, role)) {
    const mapped = IDLE_TIMEOUT_MINUTES_BY_ROLE[role];
    if (typeof mapped === "number") return mapped;
  }
  return IDLE_TIMEOUT_MINUTES_STRICTEST;
}

/** Idle evaluation result — the pure decision the hook renders from. */
export interface IdleState {
  /** The idle deadline has passed — the caller should sign out. */
  timedOut: boolean;
  /** Inside the warning window (deadline − warningLead ≤ idle < deadline). */
  warning: boolean;
  /** Whole seconds until timeout; only meaningful while `warning` is true. */
  secondsLeft: number;
}

/**
 * Pure idle-state decision — no timers, DOM, or React. Given how long the user
 * has been idle and the timeout/warning windows (all in ms), return whether to
 * warn, time out, and the seconds remaining. Extracted from the hook so the
 * core timing logic is unit-testable in the node test env.
 */
export function evaluateIdleState(
  idleForMs: number,
  timeoutMs: number,
  warningLeadMs: number,
): IdleState {
  if (timeoutMs <= 0) return { timedOut: false, warning: false, secondsLeft: 0 };
  if (idleForMs >= timeoutMs) return { timedOut: true, warning: false, secondsLeft: 0 };

  const warningAtMs = Math.max(0, timeoutMs - warningLeadMs);
  if (idleForMs >= warningAtMs) {
    return {
      timedOut: false,
      warning: true,
      secondsLeft: Math.max(0, Math.ceil((timeoutMs - idleForMs) / 1000)),
    };
  }
  return { timedOut: false, warning: false, secondsLeft: 0 };
}
