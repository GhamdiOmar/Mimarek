/**
 * Unit status state machine.
 *
 * Transition graph (sane defaults — mirrors real-estate lifecycle):
 *
 *   AVAILABLE    → RESERVED | MAINTENANCE | SUSPENDED | WITHDRAWN
 *   RESERVED     → SOLD | RENTED | AVAILABLE | SUSPENDED
 *   SOLD         → HANDED_OVER | WITHDRAWN
 *   RENTED       → AVAILABLE | MAINTENANCE
 *   MAINTENANCE  → AVAILABLE | SUSPENDED | WITHDRAWN
 *   SUSPENDED    → AVAILABLE | WITHDRAWN
 *   HANDED_OVER  → (terminal)
 *   WITHDRAWN    → AVAILABLE
 *
 * Same-status writes (from === to) are no-ops and are ALLOWED without
 * calling this function — callers should short-circuit before validation.
 */
export const UNIT_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ["RESERVED", "MAINTENANCE", "SUSPENDED", "WITHDRAWN"],
  RESERVED: ["SOLD", "RENTED", "AVAILABLE", "SUSPENDED"],
  SOLD: ["HANDED_OVER", "WITHDRAWN"],
  RENTED: ["AVAILABLE", "MAINTENANCE"],
  MAINTENANCE: ["AVAILABLE", "SUSPENDED", "WITHDRAWN"],
  SUSPENDED: ["AVAILABLE", "WITHDRAWN"],
  HANDED_OVER: [],
  WITHDRAWN: ["AVAILABLE"],
};

/**
 * Returns true when the transition is permitted by the state machine.
 * Same-status transitions (from === to) are considered no-ops and return true
 * so callers that skip the check for no-ops still get a safe result.
 */
export function isValidUnitTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return (UNIT_TRANSITIONS[from] ?? []).includes(to);
}
