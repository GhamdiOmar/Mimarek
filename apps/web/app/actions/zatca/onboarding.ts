"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../../lib/auth-helpers";
import { logAuditEvent } from "../../../lib/audit";
import { serialize } from "../../../lib/serialize";
import { revalidatePath } from "next/cache";
import { ROUTES } from "../../../lib/routes";
import { generateCsr, createZatcaClient, ZatcaError } from "@repo/zatca";
import { encryptZatca, encryptZatcaOptional } from "../../../lib/zatca-crypto";
import { EGS_PUBLIC_SELECT, getPlatformEgs } from "../../../lib/zatca-server";
import { PLATFORM_SELLER } from "../../../lib/zatca-platform-config";
import {
  resolveZatcaEnvironment,
  resolveZatcaCsrEnvironment,
  zatcaCommonName,
  resolveZatcaOtp,
} from "../../../lib/zatca-env";

/**
 * Track-A platform-EGS onboarding (Mimarek PropTech Co. as the SaaS-billing seller).
 * Platform-only (`zatca:admin`, SYSTEM_ONLY). The EGS holds organizationId = NULL.
 *
 * Flow (sandbox/dev-portal): generateCsr (secp256k1) → POST /compliance (dummy OTP) →
 * encrypted-store the compliance CSID → attempt POST /production/csids → store the
 * production CSID if issued (else keep compliance creds) → status ACTIVE.
 *
 * Every secret is encrypted via encryptZatca before storage; the action returns only
 * the EGS_PUBLIC_SELECT DTO (no key material, D13).
 */

// Module-private input shape (a "use server" file may export only async functions, §4).
interface OnboardInput {
  vatNumber: string; // 15-digit — the only required input
  crNumber?: string;
  legalNameEn?: string; // defaults to PLATFORM_SELLER.legalNameEn
  legalNameAr?: string;
  egsSerialNumber?: string; // 1-<sol>|2-<model>|3-<uuid>
  invoiceTypeFlags?: string; // CSR title flags, default 1100 (standard B2B)
  industryCategory?: string;
  otp?: string; // sandbox: any value; default "123456"
}

const SANDBOX_BASE_SERIAL = "1-Mimarek|2-SaaS|3-";

export async function onboardPlatformEgs(rawInput: OnboardInput) {
  const session = await requirePermission("zatca:admin");

  const input: OnboardInput = rawInput ?? ({} as OnboardInput);
  if (!input.vatNumber || !/^\d{15}$/.test(input.vatNumber)) {
    throw new Error("A valid 15-digit VAT number is required to onboard the ZATCA EGS.");
  }
  // Mimarek's company tax identity is FIXED (PLATFORM_SELLER) — the form collects only
  // the VAT (+ a one-time OTP). Everything else defaults from config, so the admin never
  // re-types the company profile. Inputs, when present, still win (override for edge cases).
  const legalNameEn = input.legalNameEn?.trim() || PLATFORM_SELLER.legalNameEn;
  const legalNameAr = input.legalNameAr?.trim() || PLATFORM_SELLER.legalNameAr;
  const crNumber = input.crNumber?.trim() || PLATFORM_SELLER.crNumber || null;
  const industryCategory = input.industryCategory?.trim() || PLATFORM_SELLER.industryCategory;

  // The target environment for this onboarding (fail-safe SANDBOX, R5). Every paired lookup +
  // the value persisted to the EGS row use the SAME resolved env so reads can never miss writes.
  const env = resolveZatcaEnvironment();

  // Enforce a single platform EGS per environment (NULL-org rows are NULL-distinct,
  // so app logic owns this invariant). Reuse a DRAFT/RESET row; refuse to clobber ACTIVE.
  const existing = await getPlatformEgs(env);
  if (existing && existing.status === "ACTIVE") {
    throw new Error("An active platform EGS already exists. Reset it before re-onboarding.");
  }

  const egsSerialNumber =
    input.egsSerialNumber?.trim() ||
    `${SANDBOX_BASE_SERIAL}${crypto.randomUUID()}`;
  const invoiceTypeFlags = input.invoiceTypeFlags?.trim() || PLATFORM_SELLER.invoiceTypeFlags;
  const commonName = zatcaCommonName(input.vatNumber);

  // 1. CSR (env-specific template). secp256k1 keypair + PKCS#10.
  const { csrPem, privateKeyPem } = generateCsr({
    commonName,
    serialNumber: egsSerialNumber,
    organizationIdentifier: input.vatNumber,
    organizationUnitName: input.vatNumber.slice(0, 10),
    organizationName: legalNameEn,
    countryName: "SA",
    invoiceType: invoiceTypeFlags,
    locationAddress: PLATFORM_SELLER.nationalAddress.city,
    industryBusinessCategory: industryCategory,
    environment: resolveZatcaCsrEnvironment(),
  });

  const client = createZatcaClient({ environment: env });

  // 2. Compliance CSID (CCSID). Sandbox does not validate the OTP; non-sandbox requires a real one.
  let compliance;
  try {
    compliance = await client.requestComplianceCsid({ csrPem, otp: resolveZatcaOtp(input.otp) });
  } catch (err) {
    throw onboardError("compliance CSID", err);
  }

  // 3. Attempt the production CSID (PCSID). The dev-portal sandbox may not issue one;
  //    that is non-fatal — Track-A sandbox clearance falls back to the compliance check.
  let production: Awaited<ReturnType<typeof client.requestProductionCsid>> | null = null;
  try {
    production = await client.requestProductionCsid({
      credentials: { binarySecurityToken: compliance.binarySecurityToken, secret: compliance.secret },
      complianceRequestId: compliance.requestId,
    });
  } catch {
    production = null; // keep compliance creds; clearance uses the compliance-check path
  }

  const certBase64 = Buffer.from(
    (production ?? compliance).binarySecurityToken,
    "base64",
  ).toString("utf8");

  const data = {
    organizationId: null,
    environment: env,
    status: "ACTIVE" as const,
    egsSerialNumber,
    commonName,
    vatNumber: input.vatNumber,
    crNumber,
    legalNameEn,
    legalNameAr,
    nationalAddress: { ...PLATFORM_SELLER.nationalAddress },
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
    organizationId: session.organizationId,
    metadata: { environment: env, productionCsid: production != null, vatNumber: input.vatNumber },
  });

  revalidatePath(ROUTES.adminZatca);
  return serialize(egs);
}

/** Platform-EGS summary + recent clearance attempts for the admin surface. */
export async function getPlatformEgsSummary() {
  await requirePermission("zatca:admin");
  const egs = await db.zatcaEgsUnit.findFirst({
    where: { organizationId: null, environment: resolveZatcaEnvironment() },
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

/**
 * D30 governance: reset the platform EGS authentication (revoke the CSID, move to RESET).
 * The secret material is wiped; a fresh onboard issues a new keypair + CSID.
 */
export async function resetPlatformEgs() {
  const session = await requirePermission("zatca:admin");
  const egs = await getPlatformEgs(resolveZatcaEnvironment());
  if (!egs) throw new Error("No platform EGS to reset.");

  await db.zatcaEgsUnit.update({
    where: { id: egs.id },
    data: {
      status: "RESET",
      revokedAt: new Date(),
      privateKeyPem: null,
      csrPem: null,
      complianceRequestId: null,
      complianceToken: null,
      complianceSecret: null,
      productionToken: null,
      productionSecret: null,
      certificateBase64: null,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "ZatcaEgsUnit",
    resourceId: egs.id,
    organizationId: session.organizationId,
    metadata: { action: "RESET" },
  });

  revalidatePath(ROUTES.adminZatca);
  return { ok: true };
}

function onboardError(stage: string, err: unknown): Error {
  if (err instanceof ZatcaError) {
    // No payload/key material in the message (D13) — only stage + ZATCA codes.
    const codes = err.codes.length ? ` [${err.codes.join(", ")}]` : "";
    return new Error(`ZATCA onboarding failed at ${stage}${codes}. Please try again.`);
  }
  return new Error(`ZATCA onboarding failed at ${stage}. Please try again.`);
}
