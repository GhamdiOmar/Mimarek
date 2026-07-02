"use server";

import { db, type Prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../../lib/auth-helpers";
import { logAuditEvent } from "../../../lib/audit";
import { encryptMoyasar } from "../../../lib/payment/moyasar-crypto";

// ═══════════════════════════════════════════════════════════════════════════════
// Payment-gateway credentials (platform admin, billing:admin / SYSTEM-only)
//
// Secrets are AES-256-GCM `m1:` envelopes on GatewayConfig (moyasar-crypto.ts).
// The summary DTO below is the GATEWAY_PUBLIC_SELECT equivalent — it exposes only
// booleans + non-secret mode/flags, NEVER a decrypted key. Mirrors the ZATCA
// EGS_PUBLIC_SELECT / onboardPlatformEgs pattern.
// ═══════════════════════════════════════════════════════════════════════════════

const GATEWAY = "moyasar";
const DISPLAY = "Moyasar";

export interface GatewayConfigSummary {
  gateway: string;
  displayName: string;
  isEnabled: boolean;
  isPrimary: boolean;
  mode: "test" | "live";
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  hasPublishableKey: boolean;
  updatedAt: string | null;
}

/** Secret-free view of the Moyasar gateway config. `billing:admin` (SYSTEM-only). */
export async function getGatewayConfigSummary(): Promise<GatewayConfigSummary> {
  await requirePermission("billing:admin");

  const cfg = await db.gatewayConfig.findUnique({
    where: { gateway: GATEWAY },
    // Read the encrypted columns ONLY to compute presence booleans — they are
    // never returned to the client.
    select: {
      displayName: true,
      isEnabled: true,
      isPrimary: true,
      config: true,
      apiKeyEncrypted: true,
      webhookSecretEncrypted: true,
      publishableKeyEncrypted: true,
      updatedAt: true,
    },
  });

  const mode = (cfg?.config as { mode?: string } | null)?.mode === "live" ? "live" : "test";

  return {
    gateway: GATEWAY,
    displayName: cfg?.displayName ?? DISPLAY,
    isEnabled: cfg?.isEnabled ?? false,
    isPrimary: cfg?.isPrimary ?? false,
    mode,
    hasApiKey: !!cfg?.apiKeyEncrypted,
    hasWebhookSecret: !!cfg?.webhookSecretEncrypted,
    hasPublishableKey: !!cfg?.publishableKeyEncrypted,
    updatedAt: cfg?.updatedAt ? cfg.updatedAt.toISOString() : null,
  };
}

/**
 * Upsert the Moyasar gateway credentials + config. `billing:admin` (SYSTEM-only).
 * A secret is only overwritten when a non-empty value is supplied — so an admin
 * can flip mode/enabled/primary without re-entering keys. Returns the secret-free
 * summary; the plaintext secret never leaves this server boundary.
 */
export async function upsertMoyasarCredentials(input: {
  apiKey?: string;
  webhookSecret?: string;
  publishableKey?: string;
  mode?: "test" | "live";
  isEnabled?: boolean;
  isPrimary?: boolean;
}): Promise<GatewayConfigSummary> {
  const session = await requirePermission("billing:admin");

  const apiKeyEncrypted = input.apiKey?.trim() ? encryptMoyasar(input.apiKey.trim()) : undefined;
  const webhookSecretEncrypted = input.webhookSecret?.trim() ? encryptMoyasar(input.webhookSecret.trim()) : undefined;
  const publishableKeyEncrypted = input.publishableKey?.trim() ? encryptMoyasar(input.publishableKey.trim()) : undefined;
  const mode: "test" | "live" = input.mode === "live" ? "live" : "test";
  const config = { mode } as Prisma.InputJsonValue;

  await db.gatewayConfig.upsert({
    where: { gateway: GATEWAY },
    create: {
      gateway: GATEWAY,
      displayName: DISPLAY,
      isEnabled: input.isEnabled ?? false,
      isPrimary: input.isPrimary ?? false,
      config,
      ...(apiKeyEncrypted ? { apiKeyEncrypted } : {}),
      ...(webhookSecretEncrypted ? { webhookSecretEncrypted } : {}),
      ...(publishableKeyEncrypted ? { publishableKeyEncrypted } : {}),
    },
    update: {
      displayName: DISPLAY,
      config,
      ...(typeof input.isEnabled === "boolean" ? { isEnabled: input.isEnabled } : {}),
      ...(typeof input.isPrimary === "boolean" ? { isPrimary: input.isPrimary } : {}),
      ...(apiKeyEncrypted ? { apiKeyEncrypted } : {}),
      ...(webhookSecretEncrypted ? { webhookSecretEncrypted } : {}),
      ...(publishableKeyEncrypted ? { publishableKeyEncrypted } : {}),
    },
  });

  // Audit — record WHAT changed, never the secret values.
  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "GatewayConfig",
    resourceId: GATEWAY,
    metadata: {
      mode,
      apiKeyUpdated: !!apiKeyEncrypted,
      webhookSecretUpdated: !!webhookSecretEncrypted,
      publishableKeyUpdated: !!publishableKeyEncrypted,
      isEnabled: input.isEnabled,
      isPrimary: input.isPrimary,
    },
    organizationId: session.organizationId,
  });

  revalidatePath("/dashboard/admin/integrations");
  return getGatewayConfigSummary();
}
