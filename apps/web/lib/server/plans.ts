import "server-only";

import { db } from "@repo/db";
import { unstable_cache } from "next/cache";
import { serialize } from "../serialize";

/**
 * Get all public plans with their entitlements.
 * Cached for 5 minutes — plans rarely change.
 *
 * Intentionally NOT a "use server" file: unstable_cache returns a plain
 * async function, which Next.js would refuse to export from a Server Action
 * module (only async functions are allowed as named exports there).
 * Import this from page/layout/component Server Components, never from a
 * "use server" actions file.
 *
 * Cache key ["public-plans"] and tag "plans" are stable for a future
 * migration to the `"use cache"` directive once an app-wide opt-in lands.
 *
 * NOTE: client components must NOT import this directly (it pulls @repo/db / pg
 * into the client bundle). They call the thin async server-action wrapper
 * `getPlans` re-exported from app/actions/billing.ts, which runs this on the
 * server and returns the (already-serialized) result over RPC.
 */
export const getPublicPlans = unstable_cache(
  async () => {
    const plans = await db.plan.findMany({
      where: { isPublic: true },
      include: { entitlements: true },
      orderBy: { sortOrder: "asc" },
    });
    return serialize(plans);
  },
  ["public-plans"],
  { tags: ["plans"], revalidate: 300 }
);
