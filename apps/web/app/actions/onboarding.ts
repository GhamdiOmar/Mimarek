"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { getTenantSessionOrThrow } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { notifyAdmins } from "../../lib/create-notification";
import { checkRateLimit, peekRateLimit } from "../../lib/rate-limit";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function maskOrgName(name: string): string {
  if (name.length <= 6) return name;
  return name.slice(0, 4) + "***" + name.slice(-2);
}

function isValidCR(cr: string): boolean {
  return /^\d{10}$/.test(cr);
}

function isValidVAT(vat: string): boolean {
  return /^3\d{13}3$/.test(vat);
}

// â”€â”€â”€ 1. lookupOrgByCR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function lookupOrgByCR(crNumber: string) {
  const session = await getTenantSessionOrThrow();

  // Rate limit check (read-only â€” an invalid-format CR must consume no quota)
  const peek = await peekRateLimit(`cr-lookup:${session.userId}`, 5);
  if (!peek.allowed) {
    return { found: false, error: "TOO_MANY_LOOKUPS" };
  }

  if (!isValidCR(crNumber)) {
    return { found: false, error: "INVALID_CR_FORMAT" };
  }

  const rl = await checkRateLimit(`cr-lookup:${session.userId}`, 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    return { found: false, error: "TOO_MANY_LOOKUPS" };
  }

  try {
    const org = await db.organization.findUnique({
      where: { crNumber },
    });

    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "READ",
      resource: "Organization",
      resourceId: org?.id,
      metadata: { action: "CR_LOOKUP", crNumber },
      organizationId: session.organizationId,
    });

    if (org) {
      return {
        found: true,
        orgId: org.id,
        maskedName: maskOrgName(org.name),
      };
    }

    return { found: false };
  } catch (error) {
    console.error("[Onboarding] CR lookup failed:", error);
    return { found: false, error: "LOOKUP_FAILED" };
  }
}

// â”€â”€â”€ 2. createJoinRequest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createJoinRequest(data: {
  targetOrgId: string;
  crNumber: string;
  reason?: string;
}) {
  const session = await getTenantSessionOrThrow();

  try {
    // Check user isn't already in target org
    if (session.organizationId === data.targetOrgId) {
      return { success: false, error: "ALREADY_IN_ORG" };
    }

    // Check no existing PENDING_JOIN request from this user to this org
    const existingRequest = await db.joinRequest.findFirst({
      where: {
        userId: session.userId,
        targetOrgId: data.targetOrgId,
        status: "PENDING_JOIN",
      },
    });

    if (existingRequest) {
      return { success: false, error: "REQUEST_ALREADY_EXISTS" };
    }

    // Create JoinRequest with expiresAt = now + 14 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const joinRequest = await db.joinRequest.create({
      data: {
        userId: session.userId,
        targetOrgId: data.targetOrgId,
        crNumber: data.crNumber,
        reason: data.reason ?? null,
        status: "PENDING_JOIN",
        expiresAt,
      },
    });

    // Notify target org admins
    await notifyAdmins({
      type: "JOIN_REQUEST",
      title: "Ø·Ù„Ø¨ Ø§Ù†Ø¶Ù…Ø§Ù… Ø¬Ø¯ÙŠØ¯",
      titleEn: "New Join Request",
      message: `${session.name ?? session.email} ÙŠØ·Ù„Ø¨ Ø§Ù„Ø§Ù†Ø¶Ù…Ø§Ù… Ø¥Ù„Ù‰ Ø§Ù„Ù…Ù†Ø´Ø£Ø©`,
      messageEn: `${session.name ?? session.email} requested to join the organization`,
      link: "/dashboard/settings/team",
      organizationId: data.targetOrgId,
    });

    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "CREATE",
      resource: "JoinRequest",
      resourceId: joinRequest.id,
      metadata: { targetOrgId: data.targetOrgId, crNumber: data.crNumber },
      organizationId: session.organizationId,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[Onboarding] Create join request failed:", error);
    return { success: false, error: "CREATE_FAILED" };
  }
}

// â”€â”€â”€ 3. convertPersonalOrg â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function convertPersonalOrg(crNumber: string) {
  const session = await getTenantSessionOrThrow();

  if (!isValidCR(crNumber)) {
    return { success: false, error: "INVALID_CR_FORMAT" };
  }

  try {
    // Attempt update directly â€” rely on unique constraint for atomicity
    await db.organization.update({
      where: { id: session.organizationId },
      data: { crNumber },
    });

    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "UPDATE",
      resource: "Organization",
      resourceId: session.organizationId,
      metadata: { action: "CONVERT_PERSONAL_ORG", crNumber },
      organizationId: session.organizationId,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    if (error.code === "P2002" && error.meta?.target?.includes("crNumber")) {
      return { success: false, error: "CR_TAKEN" };
    }
    console.error("[Onboarding] Convert personal org failed:", error);
    return { success: false, error: "CONVERT_FAILED" };
  }
}

// â”€â”€â”€ 4. updateOnboardingOrg â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function updateOnboardingOrg(data: {
  nameArabic?: string;
  nameEnglish?: string;
  crNumber?: string;
  vatNumber?: string;
  entityType?: string;
  legalForm?: string;
}) {
  const session = await getTenantSessionOrThrow();

  try {
    // Validate CR format if provided
    if (data.crNumber && !isValidCR(data.crNumber)) {
      return { success: false, error: "INVALID_CR_FORMAT" };
    }

    // Validate VAT format if provided (15 digits, starts and ends with 3)
    if (data.vatNumber && !isValidVAT(data.vatNumber)) {
      return { success: false, error: "INVALID_VAT_FORMAT" };
    }

    // Attempt update directly â€” rely on unique constraints for atomicity
    await db.organization.update({
      where: { id: session.organizationId },
      data: {
        ...(data.nameArabic !== undefined && { nameArabic: data.nameArabic }),
        ...(data.nameEnglish !== undefined && { nameEnglish: data.nameEnglish }),
        ...(data.crNumber !== undefined && { crNumber: data.crNumber }),
        ...(data.vatNumber !== undefined && { vatNumber: data.vatNumber }),
        ...(data.entityType !== undefined && { entityType: data.entityType as any }),
        ...(data.legalForm !== undefined && { legalForm: data.legalForm as any }),
      },
    });

    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "UPDATE",
      resource: "Organization",
      resourceId: session.organizationId,
      metadata: { action: "ONBOARDING_ORG_UPDATE", fields: Object.keys(data) },
      organizationId: session.organizationId,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target?.includes("crNumber")) return { success: false, error: "CR_TAKEN" };
      if (target?.includes("vatNumber")) return { success: false, error: "VAT_TAKEN" };
    }
    console.error("[Onboarding] Update org failed:", error);
    return { success: false, error: "UPDATE_FAILED" };
  }
}

// â”€â”€â”€ 5. updateOnboardingContact â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function updateOnboardingContact(data: {
  mobileNumber?: string;
  city?: string;
  region?: string;
}) {
  const session = await getTenantSessionOrThrow();

  try {
    // Fetch current org to merge JSON fields
    const currentOrg = await db.organization.findUnique({
      where: { id: session.organizationId },
      select: { contactInfo: true, nationalAddress: true },
    });

    const contactInfo = (currentOrg?.contactInfo as Record<string, unknown>) ?? {};
    const nationalAddress = (currentOrg?.nationalAddress as Record<string, unknown>) ?? {};

    if (data.mobileNumber !== undefined) {
      contactInfo.mobileNumber = data.mobileNumber;
    }
    if (data.city !== undefined) {
      nationalAddress.city = data.city;
    }
    if (data.region !== undefined) {
      nationalAddress.region = data.region;
    }

    await db.organization.update({
      where: { id: session.organizationId },
      data: {
        contactInfo: contactInfo as any,
        nationalAddress: nationalAddress as any,
      },
    });

    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "UPDATE",
      resource: "Organization",
      resourceId: session.organizationId,
      metadata: { action: "ONBOARDING_CONTACT_UPDATE", fields: Object.keys(data) },
      organizationId: session.organizationId,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[Onboarding] Update contact failed:", error);
    return { success: false, error: "UPDATE_FAILED" };
  }
}

// â”€â”€â”€ 6. completeOnboarding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function completeOnboarding() {
  const session = await getTenantSessionOrThrow();

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { onboardingCompleted: true },
    });

    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "UPDATE",
      resource: "User",
      resourceId: session.userId,
      metadata: { action: "ONBOARDING_COMPLETED" },
      organizationId: session.organizationId,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[Onboarding] Complete onboarding failed:", error);
    return { success: false, error: "COMPLETE_FAILED" };
  }
}

// â”€â”€â”€ 7. getMyJoinRequests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getMyJoinRequests() {
  const session = await getTenantSessionOrThrow();

  try {
    return await db.joinRequest.findMany({
      where: { userId: session.userId },
      include: {
        targetOrg: {
          select: {
            id: true,
            name: true,
            nameArabic: true,
            nameEnglish: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[Onboarding] Get join requests failed:", error);
    return [];
  }
}
