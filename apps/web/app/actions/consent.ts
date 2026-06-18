"use server";

import { db } from "@repo/db";
import { headers } from "next/headers";
import { auth } from "../../auth";

/** Minimize an IPv4 address to /24 (drop the last octet) for data minimization. */
function truncateIp(forwarded: string | null): string | null {
  if (!forwarded) return null;
  const first = forwarded.split(",")[0]?.trim() ?? "";
  if (!first) return null;
  if (first.includes(".")) {
    const parts = first.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    return null;
  }
  // IPv6 — keep only the routing prefix
  if (first.includes(":")) return first.split(":").slice(0, 3).join(":") + "::";
  return null;
}

/**
 * Persist a cookie-consent choice server-side (PDPL documented-consent audit
 * trail). Append-only; fire-and-forget from the client — it must NEVER block or
 * break the consent UX, so every failure is swallowed (fail-open).
 */
// eslint-disable-next-line mimaric/require-action-guard -- records an anonymous visitor's cookie-consent pre-auth (fail-open, no session by design).
export async function recordConsent(input: {
  version: number;
  analytics: boolean;
  necessary: boolean;
  locale: string;
  method: string;
}): Promise<void> {
  try {
    const [session, h] = await Promise.all([auth(), headers()]);
    await db.consentLog.create({
      data: {
        userId: session?.user?.id ?? null,
        version: input.version,
        analytics: input.analytics,
        necessary: input.necessary,
        locale: input.locale === "ar" || input.locale === "en" ? input.locale : "ar",
        method: input.method === "preferences" ? "preferences" : "banner",
        ipTruncated: truncateIp(h.get("x-forwarded-for")),
        userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch {
    // Audit write is best-effort — the live cookie remains the source of truth.
  }
}
