"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";

export async function getSeoConfig() {
  await requirePermission("billing:admin");
  return db.systemConfig.findUnique({ where: { id: "system" } });
}

export async function upsertSeoConfig(data: Record<string, string | null | undefined>) {
  await requirePermission("billing:admin");
  return db.systemConfig.upsert({
    where: { id: "system" },
    update: data,
    create: { id: "system", ...data },
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
