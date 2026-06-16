import "server-only";

import { db } from "@repo/db";

/**
 * Marketplace conveyance master kill-switch.
 *
 * Reads `SystemConfig.marketplaceConveyanceEnabled` (the id="system" singleton)
 * DIRECTLY from the DB on EVERY call — deliberately UNCACHED (no `unstable_cache`,
 * no React `cache()`). This is a kill-switch: flipping it off must take effect on
 * the very next settlement attempt with no cache TTL window.
 *
 * Fails CLOSED: a missing row / missing flag / any falsy value → `false`. The
 * irreversible cross-org ownership transfer ships DARK and can only run when this
 * is explicitly `true`.
 */
export async function isConveyanceEnabled(): Promise<boolean> {
  const config = await db.systemConfig.findUnique({
    where: { id: "system" },
    select: { marketplaceConveyanceEnabled: true },
  });
  return config?.marketplaceConveyanceEnabled ?? false;
}
