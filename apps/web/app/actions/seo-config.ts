"use server";

import { db } from "@repo/db";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";

// Allowlist of the SEO / branding / analytics / verification fields the admin SEO
// page manages. CRITICAL (mass-assignment): this MUST exclude the non-SEO columns
// that share the SystemConfig singleton — the irreversible marketplace conveyance
// kill-switch (`marketplaceConveyanceEnabled`), the legal sign-off fields, the
// transactional-email config, and the `id` PK — so the SEO action can never flip
// any of those via a smuggled key. Those have their own dedicated admin actions.
const SeoConfigSchema = z.object({
  siteTitle: z.string().nullable().optional(),
  siteTitleTemplate: z.string().nullable().optional(),
  siteDescriptionAr: z.string().nullable().optional(),
  siteDescriptionEn: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  ogTitle: z.string().nullable().optional(),
  ogDescription: z.string().nullable().optional(),
  ogType: z.string().nullable().optional(),
  ogLocale: z.string().nullable().optional(),
  twitterCard: z.string().nullable().optional(),
  twitterHandle: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  appleTouchIconUrl: z.string().nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  logoLightUrl: z.string().nullable().optional(),
  logoDarkUrl: z.string().nullable().optional(),
  gtmContainerId: z.string().nullable().optional(),
  ga4MeasurementId: z.string().nullable().optional(),
  gadsConversionId: z.string().nullable().optional(),
  gscVerificationCode: z.string().nullable().optional(),
  bingVerificationCode: z.string().nullable().optional(),
  robotsTxtRules: z.string().nullable().optional(),
  schemaOrgName: z.string().nullable().optional(),
  schemaOrgLogoUrl: z.string().nullable().optional(),
  schemaOrgTwitter: z.string().nullable().optional(),
  schemaOrgLinkedIn: z.string().nullable().optional(),
  schemaOrgInstagram: z.string().nullable().optional(),
  regaPlatformFalLicense: z.string().nullable().optional(),
});

export async function getSeoConfig() {
  await requirePermission("billing:admin");
  return db.systemConfig.findUnique({ where: { id: "system" } });
}

export async function upsertSeoConfig(data: Record<string, string | null | undefined>) {
  await requirePermission("billing:admin");
  const parsed = SeoConfigSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid SEO configuration input.");
  }
  const safe = parsed.data;
  return db.systemConfig.upsert({
    where: { id: "system" },
    update: safe,
    create: { id: "system", ...safe },
  });
}

// Public read — no auth required (used by layout.tsx and robots.ts)
// eslint-disable-next-line mimaric/require-action-guard -- public marketing-site SEO config (no tenant data or PII); intentionally unauthenticated.
export async function getSeoConfigPublic() {
  try {
    return db.systemConfig.findUnique({ where: { id: "system" } });
  } catch {
    return null;
  }
}
