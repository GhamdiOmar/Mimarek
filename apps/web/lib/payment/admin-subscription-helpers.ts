import { db } from "@repo/db";

/**
 * Helpers for the admin subscription server actions (`app/actions/admin-subscriptions.ts`).
 * `eventCategoryForDelta` is SYNCHRONOUS, and a `"use server"` file may export
 * only async functions (§4) — so these sync/shared helpers live in this plain
 * (non-"use server") module rather than being exported from the action file.
 */

/** Fetch a subscription or throw a friendly (sanitizer-mapped) error. */
export async function getSubscriptionOrThrow(subscriptionId: string) {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new Error("Subscription not found. Refresh the page and try again.");
  return sub;
}

/** EXPANSION when MRR rises, CONTRACTION when it falls, null when flat. */
export function eventCategoryForDelta(delta: number): "EXPANSION" | "CONTRACTION" | null {
  if (delta > 0) return "EXPANSION";
  if (delta < 0) return "CONTRACTION";
  return null;
}
