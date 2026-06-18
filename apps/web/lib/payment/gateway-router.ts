/**
 * Payment Gateway Router
 *
 * Routes to the active (primary) gateway based on system config.
 * Supports multiple gateways with a primary/fallback pattern.
 */

import type { GatewayName, PaymentProvider } from "./types";
import { moyasarAdapter } from "./moyasar-adapter";
import { db } from "@repo/db";

// ─── Gateway Registry ───────────────────────────────────────────────────────

const GATEWAY_ADAPTERS: Record<GatewayName, PaymentProvider | null> = {
  moyasar: moyasarAdapter,
  // Future: hyperpayAdapter, paytabsAdapter
  hyperpay: null, // Placeholder — not yet implemented
  paytabs: null,  // Placeholder — not yet implemented
};

// ─── Router ─────────────────────────────────────────────────────────────────

/**
 * Get the primary payment gateway adapter.
 * Checks GatewayConfig table for the enabled primary, defaults to Moyasar.
 */
export async function getPrimaryGateway(): Promise<PaymentProvider> {
  try {
    const config = await db.gatewayConfig.findFirst({
      where: { isEnabled: true, isPrimary: true },
    });

    if (config) {
      const adapter = GATEWAY_ADAPTERS[config.gateway as GatewayName];
      if (adapter) return adapter;
    }
  } catch {
    // DB not available or table not ready — fall through to default
  }

  // Default to Moyasar
  return moyasarAdapter;
}

/**
 * Get a specific gateway adapter by name.
 */
export function getGateway(name: GatewayName): PaymentProvider {
  const adapter = GATEWAY_ADAPTERS[name];
  if (!adapter) {
    throw new Error(`Payment gateway '${name}' is not implemented`);
  }
  return adapter;
}

/**
 * Get all enabled gateways.
 */
export async function getEnabledGateways(): Promise<{ name: string; displayName: string; isPrimary: boolean }[]> {
  const configs = await db.gatewayConfig.findMany({
    where: { isEnabled: true },
    orderBy: { isPrimary: "desc" },
  });

  return configs.map((c) => ({
    name: c.gateway,
    displayName: c.displayName,
    isPrimary: c.isPrimary,
  }));
}
