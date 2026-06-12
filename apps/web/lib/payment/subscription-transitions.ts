/**
 * Subscription Transition Map (pure module — no runtime deps)
 *
 * State Diagram:
 *   TRIALING → ACTIVE → PAST_DUE → UNPAID → CANCELED
 *                ↑         │                    │
 *                └─────────┘ (retry succeeds)   │
 *                ↑                              │
 *                └──────────────────────────────┘ (user resubscribes)
 *
 * Note: the same-state no-op short-circuit (from === to → return early)
 * lives in the caller (subscription-machine.ts), not here — so a
 * same-state pair is NOT a valid transition by this map.
 */

import type { SubscriptionStatus } from "@prisma/client";

export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIALING: ["ACTIVE", "PAST_DUE", "CANCELED"],
  ACTIVE: ["PAST_DUE", "PAUSED", "CANCELED"],
  PAST_DUE: ["ACTIVE", "UNPAID", "CANCELED"],
  UNPAID: ["ACTIVE", "CANCELED"],
  PAUSED: ["ACTIVE", "CANCELED"],
  CANCELED: ["ACTIVE"], // Resubscription
};

export function isValidSubscriptionTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): boolean {
  return SUBSCRIPTION_TRANSITIONS[from]?.includes(to) ?? false;
}
