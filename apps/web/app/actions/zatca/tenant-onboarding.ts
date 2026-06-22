"use server";

import { db, type Prisma } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { logAuditEvent } from "../../../lib/audit";
import { serialize } from "../../../lib/serialize";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../../lib/routes";
import { generateCsr, createZatcaClient, ZatcaError } from "@repo/zatca";
import { encryptZatca, encryptZatcaOptional } from "../../../lib/zatca-crypto";
import { EGS_PUBLIC_SELECT, getTenantEgs } from "../../../lib/zatca-server";

/**
 * Track-B tenant-EGS onboarding (R3). Each customer org onboards its OWN EGS
 * (`ZatcaEgsUnit.organizationId = <orgId>`), gated by the tenant `zatca:config`
 * permission. This is the per-org generalization of `onboardPlatformEgs` — the
 * tax identity comes from the org's own profile (Organization), NOT PLATFORM_SELLER,
 * so copying the platform constants verbatim (which would onboard every tenant under
 * Mimarek's identity — a compliance bug) is avoided.
 *
 * Flow (SANDBOX only in R3; environment threading is R5): generateCsr (per-org
 * identity) → POST /compliance (dummy OTP) → encrypted-store the CSID → attempt the
 * production CSID (non-fatal) → status ACTIVE. Every secret is encryptZatca-wrapped;
 * the action returns only the EGS_PUBLIC_SELECT DTO (no key material, D13).
 *
 * R3 does NOT issue any document — there is no caller of clearSubscriptionInvoiceInternal
 * here. Tenant issuance (and per-branch CSRs) land in R4.
 */

// Module-private input shape (a "use server" file may export only async functions, §4).
interface TenantOnboardInput {
  vatNumber?: string; // defaults to the org's VAT; must resolve to a 15-digit number
  invoiceTypeFlags?: string; // CSR title flags, default 1100 (standard B2B)
  otp?: string; // sandbox: any value; default "123456"
}

// The per-tenant EGS serial: ZATCA's 1-<solution>|2-<model>|3-<uuid> structure. Each
// tenant gets a FRESH segment-3 UUID — never the platform serial (compliance identity).
const TENANT_BASE_SERIAL = "1-Mimarek|2-SaaS|3-";

function addrField(addr: unknown, key: string, fallback: string): string {
  const a = (addr ?? {}) as Record<string, unknown>;
  const v = a[key];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export async function onboardTenantEgs(rawInput: TenantOnboardInput) {
  const session = await requirePermission("zatca:config");
  const organizationId = session.organizationId;
  if (!organizationId) {
    throw new Error("An organization context is required to onboard ZATCA.");
  }

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      nameArabic: true,
      nameEnglish: true,
      crNumber: true,
      vatNumber: true,
      nationalAddress: true,
      mainActivityNameAr: true,
    },
  });
  if (!org) throw new Error("Organization not found.");

  const input: TenantOnboardInput = rawInput ?? {};
  const vatNumber = input.vatNumber?.trim() || org.vatNumber?.trim() || "";
  if (!/^\d{15}$/.test(vatNumber)) {
    throw new Error(
      "A valid 15-digit VAT number is required. Add your VAT number in organization settings, or enter it here.",
    );
  }

  // Per-org single-ACTIVE-EGS guard (DB-backed by zatca_egs_one_active_per_org_env).
  // Reuse a DRAFT/RESET row; refuse to clobber an ACTIVE one (D30 — locked).
  const existing = await getTenantEgs(organizationId, "SANDBOX");
  if (existing && existing.status === "ACTIVE") {
    throw new Error(
      "Your ZATCA connection is already active and locked. Contact support to reset it before re-onboarding.",
    );
  }

  // Per-org tax identity (the per-org analogue of PLATFORM_SELLER).
  const legalNameEn = org.nameEnglish?.trim() || org.name;
  const legalNameAr = org.nameArabic?.trim() || org.name;
  const crNumber = org.crNumber?.trim() || null;
  const industryCategory = org.mainActivityNameAr?.trim() || "Real Estate";
  const invoiceTypeFlags = input.invoiceTypeFlags?.trim() || "1100";
  const egsSerialNumber = `${TENANT_BASE_SERIAL}${crypto.randomUUID()}`;
  // SANDBOX test-CSID prefix; R5 switches the prefix by environment.
  const commonName = `TST-886431145-${vatNumber}`;
  const city = addrField(org.nationalAddress, "city", "Riyadh");

  // 1. CSR (sandbox template) — secp256k1 keypair + PKCS#10, per-org identity.
  const { csrPem, privateKeyPem } = generateCsr({
    commonName,
    serialNumber: egsSerialNumber,
    organizationIdentifier: vatNumber,
    organizationUnitName: vatNumber.slice(0, 10),
    organizationName: legalNameEn,
    countryName: "SA",
    invoiceType: invoiceTypeFlags,
    locationAddress: city,
    industryBusinessCategory: industryCategory,
    environment: "sandbox",
  });

  const client = createZatcaClient({ environment: "SANDBOX" });

  // 2. Compliance CSID (CCSID). Sandbox does not validate the OTP.
  let compliance;
  try {
    compliance = await client.requestComplianceCsid({ csrPem, otp: input.otp?.trim() || "123456" });
  } catch (err) {
    throw onboardError("compliance CSID", err);
  }

  // 3. Production CSID (PCSID) — non-fatal in sandbox; clearance falls back to the
  //    compliance-check path when production isn't issued.
  let production: Awaited<ReturnType<typeof client.requestProductionCsid>> | null = null;
  try {
    production = await client.requestProductionCsid({
      credentials: { binarySecurityToken: compliance.binarySecurityToken, secret: compliance.secret },
      complianceRequestId: compliance.requestId,
    });
  } catch {
    production = null;
  }

  const certBase64 = Buffer.from((production ?? compliance).binarySecurityToken, "base64").toString("utf8");

  const data = {
    organizationId,
    environment: "SANDBOX" as const,
    status: "ACTIVE" as const,
    egsSerialNumber,
    commonName,
    vatNumber,
    crNumber,
    legalNameEn,
    legalNameAr,
    nationalAddress: (org.nationalAddress ?? undefined) as Prisma.InputJsonValue | undefined,
    invoiceTypeFlags,
    industryCategory,
    privateKeyPem: encryptZatca(privateKeyPem),
    csrPem: encryptZatca(csrPem),
    complianceRequestId: encryptZatcaOptional(String(compliance.requestId)),
    complianceToken: encryptZatca(compliance.binarySecurityToken),
    complianceSecret: encryptZatca(compliance.secret),
    productionToken: encryptZatcaOptional(production?.binarySecurityToken),
    productionSecret: encryptZatcaOptional(production?.secret),
    certificateBase64: encryptZatca(certBase64),
    onboardedAt: new Date(),
    revokedAt: null,
  };

  const egs = existing
    ? await db.zatcaEgsUnit.update({ where: { id: existing.id }, data, select: EGS_PUBLIC_SELECT })
    : await db.zatcaEgsUnit.create({ data, select: EGS_PUBLIC_SELECT });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: existing ? "UPDATE" : "CREATE",
    resource: "ZatcaEgsUnit",
    resourceId: egs.id,
    organizationId,
    metadata: { environment: "SANDBOX", productionCsid: production != null, vatNumber },
  });

  revalidatePath(ROUTES.settingsZatca);
  return serialize(egs);
}

/** The tenant org's own EGS summary + recent clearance attempts for the settings surface. */
export async function getTenantEgsSummary() {
  const session = await requirePermission("zatca:config");
  const organizationId = session.organizationId;
  if (!organizationId) throw new Error("An organization context is required.");

  const egs = await db.zatcaEgsUnit.findFirst({
    where: { organizationId, environment: "SANDBOX" },
    select: EGS_PUBLIC_SELECT,
  });
  const logs = egs
    ? await db.zatcaClearanceLog.findMany({
        where: { egsUnitId: egs.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      })
    : [];
  return serialize({ egs, logs });
}

function onboardError(stage: string, err: unknown): Error {
  if (err instanceof ZatcaError) {
    // No payload/key material in the message (D13) — only stage + ZATCA codes.
    const codes = err.codes.length ? ` [${err.codes.join(", ")}]` : "";
    return new Error(`ZATCA onboarding failed at ${stage}${codes}. Please try again.`);
  }
  return new Error(`ZATCA onboarding failed at ${stage}. Please try again.`);
}
