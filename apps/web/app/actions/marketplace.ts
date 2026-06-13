"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { serialize } from "../../lib/serialize";
import {
  listPublishedListingsForBuyer,
  getPublishedListingForBuyer,
  listSellerOrgsWithListings,
  type MarketplaceListingFilters,
} from "../../lib/marketplace/listing-view";
import { encryptCustomerData } from "../../lib/pii-crypto";
import { normalizeSaudiPhoneE164 } from "../../lib/phone";

// Saudi National Address short code: 4 letters + 4 digits (e.g. "RRRA2929").
const SHORT_ADDRESS_RE = /^[A-Z]{4}\d{4}$/;
export async function isValidShortAddress(value: string): Promise<boolean> {
  return SHORT_ADDRESS_RE.test(value.trim().toUpperCase());
}

function genListingNumber(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ML-${new Date().getFullYear()}-${rand}`;
}

type SellerOrgSnapshot = {
  id: string;
  name: string;
  nameArabic: string | null;
  nameEnglish: string | null;
  crNumber: string | null;
};

async function buildOrgSnapshot(orgId: string): Promise<SellerOrgSnapshot> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { id: true, name: true, nameArabic: true, nameEnglish: true, crNumber: true },
  });
  return org;
}

/** Best-effort bilingual notification to all ADMIN users of an org. */
async function notifyOrgAdmins(
  orgId: string,
  type: string,
  title: string,
  titleEn: string,
  message: string,
  messageEn: string,
  link?: string,
): Promise<void> {
  try {
    const admins = await db.user.findMany({
      where: { organizationId: orgId, role: { in: ["ADMIN", "MANAGER"] } },
      select: { id: true },
    });
    if (admins.length === 0) return;
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type,
        title,
        titleEn,
        message,
        messageEn,
        link,
        organizationId: orgId,
      })),
    });
  } catch {
    // Notifications are best-effort; never block the workflow.
  }
}

// ─── Eligibility ────────────────────────────────────────────────────────────

export type EligibilityBlocker =
  | "NOT_OWNED"
  | "NOT_AVAILABLE"
  | "ACTIVE_LEASE"
  | "ACTIVE_RESERVATION"
  | "ALREADY_LISTED"
  | "MISSING_ADDRESS";

export type EligibilityResult = {
  eligible: boolean;
  blockers: EligibilityBlocker[];
};

const ACTIVE_LISTING_STATUSES = ["DRAFT", "PUBLISHED", "UNDER_CONTRACT"] as const;

export async function validateMarketplaceEligibility(
  unitId: string,
): Promise<EligibilityResult> {
  const session = await requirePermission("marketplace:publish");
  const blockers: EligibilityBlocker[] = [];

  const unit = await db.unit.findFirst({
    where: { id: unitId, organizationId: session.organizationId },
    include: {
      leases: { where: { status: "ACTIVE" }, select: { id: true } },
      reservations: {
        where: { status: { in: ["PENDING", "CONFIRMED"] } },
        select: { id: true },
      },
      marketplaceListings: {
        where: { status: { in: [...ACTIVE_LISTING_STATUSES] } },
        select: { id: true },
      },
    },
  });

  if (!unit) {
    return { eligible: false, blockers: ["NOT_OWNED"] };
  }
  if (unit.status !== "AVAILABLE") blockers.push("NOT_AVAILABLE");
  if (unit.leases.length > 0) blockers.push("ACTIVE_LEASE");
  if (unit.reservations.length > 0) blockers.push("ACTIVE_RESERVATION");
  if (unit.marketplaceListings.length > 0) blockers.push("ALREADY_LISTED");
  if (!unit.city || !unit.district) blockers.push("MISSING_ADDRESS");

  return { eligible: blockers.length === 0, blockers };
}

// ─── Seller: draft / publish / update / unpublish ───────────────────────────

export async function createMarketplaceDraft(unitId: string) {
  const session = await requirePermission("marketplace:publish");

  const result = await db.$transaction(async (tx) => {
    const unit = await tx.unit.findFirst({
      where: { id: unitId, organizationId: session.organizationId },
    });
    if (!unit) {
      throw new Error("Unit not found in your organization. Please verify the unit.");
    }
    if (unit.status !== "AVAILABLE") {
      throw new Error("Only available units can be listed on the marketplace.");
    }
    const existing = await tx.marketplaceListing.findFirst({
      where: { unitId, status: { in: [...ACTIVE_LISTING_STATUSES] } },
    });
    if (existing) {
      throw new Error("This unit already has an active marketplace listing.");
    }

    const snapshot = await buildOrgSnapshot(session.organizationId);
    const listing = await tx.marketplaceListing.create({
      data: {
        listingNumber: genListingNumber(),
        unitId,
        sellerOrgId: session.organizationId,
        status: "DRAFT",
        title: `${unit.type} ${unit.number}`,
        price: unit.markupPrice ?? unit.price ?? undefined,
        area: unit.area ?? undefined,
        city: unit.city,
        district: unit.district,
        propertyType: unit.type,
        bedrooms: unit.bedrooms ?? undefined,
        bathrooms: unit.bathrooms ?? undefined,
        sellerOrgSnapshot: snapshot,
      },
    });
    await tx.unit.update({
      where: { id: unitId },
      data: { marketplaceStatus: "DRAFT", currentMarketplaceListingId: listing.id },
    });
    return listing;
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "MarketplaceListing",
    resourceId: result.id,
    organizationId: session.organizationId,
  });
  revalidatePath("/dashboard/marketplace/my-listings");
  revalidatePath("/dashboard/units");
  return serialize(result);
}

export type PublishListingPayload = {
  title: string;
  description?: string;
  price: number;
  shortAddress: string;
  adLicenseNumber?: string;
  buildingAge?: number;
  expiresInDays?: number;
};

export async function publishMarketplaceListing(
  listingId: string,
  payload: PublishListingPayload,
) {
  const session = await requirePermission("marketplace:publish");

  if (!payload.title?.trim()) throw new Error("Listing title is required.");
  if (!payload.price || payload.price <= 0) throw new Error("A valid price is required.");
  const shortAddr = payload.shortAddress?.trim().toUpperCase();
  if (!shortAddr || !SHORT_ADDRESS_RE.test(shortAddr)) {
    throw new Error(
      "Invalid National Address short code. Format: 4 letters + 4 digits (e.g. RRRA2929).",
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.findFirst({
      where: { id: listingId, sellerOrgId: session.organizationId },
    });
    if (!listing) throw new Error("Listing not found in your organization.");
    if (listing.status !== "DRAFT" && listing.status !== "UNPUBLISHED") {
      throw new Error("Only draft or unpublished listings can be published.");
    }

    // Re-validate eligibility inside the transaction.
    const unit = await tx.unit.findFirst({
      where: { id: listing.unitId, organizationId: session.organizationId },
      include: {
        leases: { where: { status: "ACTIVE" }, select: { id: true } },
        reservations: {
          where: { status: { in: ["PENDING", "CONFIRMED"] } },
          select: { id: true },
        },
      },
    });
    if (!unit) throw new Error("Underlying unit no longer exists in your organization.");
    if (unit.status !== "AVAILABLE") throw new Error("Unit is no longer available.");
    if (unit.leases.length > 0) throw new Error("Unit now has an active lease.");
    if (unit.reservations.length > 0) throw new Error("Unit now has an active reservation.");

    const expiresAt = payload.expiresInDays
      ? new Date(Date.now() + payload.expiresInDays * 86400000)
      : null;

    const result = await tx.marketplaceListing.update({
      where: { id: listingId },
      data: {
        status: "PUBLISHED",
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        price: payload.price,
        shortAddress: shortAddr,
        adLicenseNumber: payload.adLicenseNumber?.trim() || null,
        buildingAge: payload.buildingAge ?? null,
        complianceStatus: payload.adLicenseNumber?.trim() ? "APPROVED" : "PENDING_REVIEW",
        publishedAt: new Date(),
        expiresAt,
        unpublishedReason: null,
      },
    });
    await tx.unit.update({
      where: { id: listing.unitId },
      data: { marketplaceStatus: "PUBLISHED", currentMarketplaceListingId: listingId },
    });
    return result;
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_LISTING_PUBLISHED",
    resource: "MarketplaceListing",
    resourceId: listingId,
    organizationId: session.organizationId,
  });
  revalidatePath("/dashboard/marketplace");
  revalidatePath("/dashboard/marketplace/my-listings");
  return serialize(updated);
}

export async function updateMarketplaceListing(
  listingId: string,
  payload: Partial<PublishListingPayload>,
) {
  const session = await requirePermission("marketplace:manage_own");

  const updated = await db.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.findFirst({
      where: { id: listingId, sellerOrgId: session.organizationId },
    });
    if (!listing) throw new Error("Listing not found in your organization.");
    if (listing.status === "UNDER_CONTRACT" || listing.status === "SOLD_TRANSFERRED") {
      throw new Error("This listing is under contract and can no longer be edited.");
    }
    let shortAddr = listing.shortAddress;
    if (payload.shortAddress != null) {
      shortAddr = payload.shortAddress.trim().toUpperCase();
      if (!SHORT_ADDRESS_RE.test(shortAddr)) {
        throw new Error("Invalid National Address short code (4 letters + 4 digits).");
      }
    }
    const priceChanged =
      payload.price != null && Number(payload.price) !== Number(listing.price);

    const result = await tx.marketplaceListing.update({
      where: { id: listingId },
      data: {
        title: payload.title?.trim() ?? listing.title,
        description: payload.description?.trim() ?? listing.description,
        price: payload.price ?? listing.price ?? undefined,
        shortAddress: shortAddr,
        adLicenseNumber: payload.adLicenseNumber?.trim() ?? listing.adLicenseNumber,
        buildingAge: payload.buildingAge ?? listing.buildingAge,
      },
    });

    // Edge case: price changed after buyers expressed interest → notify them.
    if (priceChanged && listing.status === "PUBLISHED") {
      const open = await tx.marketplaceInquiry.findMany({
        where: { listingId, status: "OPEN" },
        select: { buyerOrgId: true },
      });
      for (const inq of open) {
        await notifyOrgAdmins(
          inq.buyerOrgId,
          "MARKETPLACE_PRICE_CHANGED",
          "تغيّر سعر إعلان",
          "Marketplace listing price changed",
          `تم تحديث سعر إعلان كنت مهتمًا به (${listing.listingNumber}).`,
          `The price of a listing you inquired about changed (${listing.listingNumber}).`,
          `/dashboard/marketplace/${listingId}`,
        );
      }
    }
    return result;
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_LISTING_UPDATED",
    resource: "MarketplaceListing",
    resourceId: listingId,
    organizationId: session.organizationId,
  });
  revalidatePath("/dashboard/marketplace/my-listings");
  return serialize(updated);
}

export async function unpublishMarketplaceListing(listingId: string, reason: string) {
  const session = await requirePermission("marketplace:manage_own");

  const updated = await db.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.findFirst({
      where: { id: listingId, sellerOrgId: session.organizationId },
    });
    if (!listing) throw new Error("Listing not found in your organization.");
    if (listing.status !== "PUBLISHED" && listing.status !== "DRAFT") {
      throw new Error("Only draft or published listings can be unpublished.");
    }
    const result = await tx.marketplaceListing.update({
      where: { id: listingId },
      data: { status: "UNPUBLISHED", unpublishedReason: reason?.trim() || "Unpublished by seller" },
    });
    await tx.unit.updateMany({
      where: { id: listing.unitId, organizationId: session.organizationId },
      data: { marketplaceStatus: "UNPUBLISHED" },
    });
    return result;
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_LISTING_UNPUBLISHED",
    resource: "MarketplaceListing",
    resourceId: listingId,
    metadata: { reason },
    organizationId: session.organizationId,
  });
  revalidatePath("/dashboard/marketplace/my-listings");
  revalidatePath("/dashboard/marketplace");
  return serialize(updated);
}

// ─── Seller: own listings & incoming inquiries ──────────────────────────────

export async function listMyMarketplaceListings() {
  const session = await requirePermission("marketplace:manage_own");

  // Lazily expire stale published listings.
  await db.marketplaceListing.updateMany({
    where: {
      sellerOrgId: session.organizationId,
      status: "PUBLISHED",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  const listings = await db.marketplaceListing.findMany({
    where: { sellerOrgId: session.organizationId },
    include: { _count: { select: { inquiries: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return serialize(listings);
}

export async function listIncomingMarketplaceInquiries() {
  const session = await requirePermission("marketplace:inquiry:read");

  const inquiries = await db.marketplaceInquiry.findMany({
    where: { sellerOrgId: session.organizationId },
    include: {
      listing: { select: { id: true, listingNumber: true, title: true } },
      reservation: { select: { id: true, status: true } },
      transfer: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return serialize(inquiries);
}

// ─── Buyer: browse / detail / inquire ───────────────────────────────────────

export async function browseMarketplaceListings(filters: MarketplaceListingFilters = {}) {
  const session = await requirePermission("marketplace:read");
  const listings = await listPublishedListingsForBuyer(session.organizationId, filters);
  return serialize(listings);
}

export async function getMarketplaceListingDetail(listingId: string) {
  const session = await requirePermission("marketplace:read");
  const listing = await getPublishedListingForBuyer(session.organizationId, listingId);
  if (!listing) throw new Error("Listing not found or no longer available.");
  return serialize(listing);
}

export async function getMarketplaceSellerOrgFilters() {
  const session = await requirePermission("marketplace:read");
  return serialize(await listSellerOrgsWithListings(session.organizationId));
}

export async function confirmMarketplaceInterest(
  listingId: string,
  payload: { message?: string; contactName?: string; contactPhone?: string },
) {
  const session = await requirePermission("marketplace:inquiry:write");

  // Validate and normalize the contact phone (required — seller needs a real callback number).
  const normalizedPhone = normalizeSaudiPhoneE164(payload.contactPhone);
  if (!normalizedPhone) {
    throw new Error(
      "A valid Saudi mobile number is required to submit an inquiry (e.g. 05XXXXXXXX). " +
        "يجب إدخال رقم جوال سعودي صحيح لإرسال الاستفسار (مثال: 05XXXXXXXX).",
    );
  }

  // Encrypt the normalized phone before writing to the Customer table.
  const encryptedPhone = encryptCustomerData({ phone: normalizedPhone });

  const result = await db.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.findFirst({
      where: { id: listingId, status: "PUBLISHED" },
    });
    if (!listing) throw new Error("This listing is no longer available.");
    if (listing.sellerOrgId === session.organizationId) {
      throw new Error("You cannot express interest in your own organization's listing.");
    }

    const duplicate = await tx.marketplaceInquiry.findUnique({
      where: { listingId_buyerOrgId: { listingId, buyerOrgId: session.organizationId } },
    });
    if (duplicate) {
      throw new Error("Your organization has already expressed interest in this listing.");
    }

    const buyerOrg = await buildOrgSnapshot(session.organizationId);

    // Seller-side CRM customer representing the buyer organization.
    // phone is stored encrypted (AES-256-GCM) with a blind-index hash for search,
    // matching the canonical path in customers.ts:139-155.
    const crmCustomer = await tx.customer.create({
      data: {
        name: payload.contactName?.trim() || buyerOrg.nameEnglish || buyerOrg.name,
        nameArabic: buyerOrg.nameArabic ?? undefined,
        phone: encryptedPhone.phone as string,
        phoneHash: encryptedPhone.phoneHash as string,
        status: "NEW",
        source: "MARKETPLACE",
        organizationId: listing.sellerOrgId,
      },
    });

    const inquiry = await tx.marketplaceInquiry.create({
      data: {
        listingId,
        buyerOrgId: session.organizationId,
        sellerOrgId: listing.sellerOrgId,
        sellerCrmCustomerId: crmCustomer.id,
        status: "OPEN",
        message: payload.message?.trim() || null,
        buyerOrgSnapshot: buyerOrg,
      },
    });

    await tx.marketplaceListing.update({
      where: { id: listingId },
      data: { interestCount: { increment: 1 } },
    });

    return { inquiry, sellerOrgId: listing.sellerOrgId, listingNumber: listing.listingNumber };
  });

  await notifyOrgAdmins(
    result.sellerOrgId,
    "MARKETPLACE_INQUIRY",
    "اهتمام جديد بإعلان",
    "New marketplace inquiry",
    `هناك جهة مهتمة بإعلانك ${result.listingNumber}.`,
    `An organization is interested in your listing ${result.listingNumber}.`,
    `/dashboard/marketplace/my-listings`,
  );

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_INQUIRY_CREATED",
    resource: "MarketplaceInquiry",
    resourceId: result.inquiry.id,
    organizationId: session.organizationId,
  });
  revalidatePath("/dashboard/marketplace");
  return serialize(result.inquiry);
}

export async function listMyMarketplaceInquiries() {
  const session = await requirePermission("marketplace:inquiry:read");
  const inquiries = await db.marketplaceInquiry.findMany({
    where: { buyerOrgId: session.organizationId },
    include: {
      listing: {
        select: { id: true, listingNumber: true, title: true, price: true, city: true, status: true },
      },
      transfer: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return serialize(inquiries);
}

export async function withdrawMarketplaceInquiry(inquiryId: string) {
  const session = await requirePermission("marketplace:inquiry:write");

  const inquiry = await db.marketplaceInquiry.findFirst({
    where: { id: inquiryId, buyerOrgId: session.organizationId },
  });
  if (!inquiry) throw new Error("Inquiry not found for your organization.");
  if (inquiry.status !== "OPEN") {
    throw new Error("Only open inquiries can be withdrawn.");
  }

  const updated = await db.marketplaceInquiry.update({
    where: { id: inquiryId },
    data: { status: "WITHDRAWN" },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_INQUIRY_WITHDRAWN",
    resource: "MarketplaceInquiry",
    resourceId: inquiryId,
    organizationId: session.organizationId,
  });
  revalidatePath("/dashboard/marketplace");
  return serialize(updated);
}

// ─── Deal bridge: convert inquiry → cross-org reservation ────────────────────

export async function convertMarketplaceInquiryToDeal(inquiryId: string) {
  const session = await requirePermission("marketplace:inquiry:convert");

  const result = await db.$transaction(async (tx) => {
    const inquiry = await tx.marketplaceInquiry.findFirst({
      where: { id: inquiryId, sellerOrgId: session.organizationId },
      include: { listing: true },
    });
    if (!inquiry) throw new Error("Inquiry not found for your organization.");
    if (inquiry.status !== "OPEN") {
      throw new Error("Only open inquiries can be converted to a deal.");
    }
    if (!inquiry.sellerCrmCustomerId) {
      throw new Error("Inquiry has no linked CRM customer.");
    }

    const unit = await tx.unit.findFirst({
      where: { id: inquiry.listing.unitId, organizationId: session.organizationId },
    });
    if (!unit) throw new Error("Underlying unit not found in your organization.");

    // CAS: claim the unit only if still AVAILABLE, and the inquiry only if still OPEN.
    // Both checks are atomic within the transaction — concurrent converts both lose the race.
    const unitClaim = await tx.unit.updateMany({
      where: { id: unit.id, organizationId: session.organizationId, status: "AVAILABLE" },
      data: { status: "RESERVED", marketplaceStatus: "UNDER_CONTRACT" },
    });
    if (unitClaim.count === 0) {
      throw new Error("Unit is no longer available to convert.");
    }

    const inquiryClaim = await tx.marketplaceInquiry.updateMany({
      where: { id: inquiryId, status: "OPEN" },
      data: { status: "CONVERTED_TO_DEAL" },
    });
    if (inquiryClaim.count === 0) {
      throw new Error("Only open inquiries can be converted to a deal.");
    }

    // Cross-org-aware reservation (seller org owns it; buyer org tracked).
    const reservation = await tx.reservation.create({
      data: {
        customerId: inquiry.sellerCrmCustomerId,
        unitId: unit.id,
        userId: session.userId,
        status: "PENDING",
        amount: inquiry.listing.price ?? undefined,
        expiresAt: new Date(Date.now() + 14 * 86400000),
        marketplaceInquiryId: inquiry.id,
        buyerOrgId: inquiry.buyerOrgId,
        sellerOrgId: inquiry.sellerOrgId,
      },
    });

    await tx.customer.update({
      where: { id: inquiry.sellerCrmCustomerId },
      data: { status: "RESERVED" },
    });
    await tx.marketplaceListing.update({
      where: { id: inquiry.listingId },
      data: { status: "UNDER_CONTRACT" },
    });
    // updatedInquiry is no longer fetched via a separate update — reconstruct from the
    // original inquiry object with the new status so the return value stays consistent.
    const updatedInquiry = { ...inquiry, status: "CONVERTED_TO_DEAL" as const };
    const transfer = await tx.unitTransferTransaction.create({
      data: {
        inquiryId: inquiry.id,
        listingId: inquiry.listingId,
        reservationId: reservation.id,
        sellerOrgId: inquiry.sellerOrgId,
        buyerOrgId: inquiry.buyerOrgId,
        sellerUnitId: unit.id,
        status: "PENDING_SETTLEMENT",
      },
    });
    return { reservation, transfer, inquiry: updatedInquiry, buyerOrgId: inquiry.buyerOrgId, listingNumber: inquiry.listing.listingNumber };
  });

  await notifyOrgAdmins(
    result.buyerOrgId,
    "MARKETPLACE_DEAL",
    "تم قبول اهتمامك",
    "Your inquiry was accepted",
    `قبل البائع اهتمامك بالإعلان ${result.listingNumber} وبدأ إجراءات الصفقة.`,
    `The seller accepted your inquiry on ${result.listingNumber} and started the deal.`,
    `/dashboard/marketplace`,
  );

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_INQUIRY_CONVERTED",
    resource: "MarketplaceInquiry",
    resourceId: inquiryId,
    organizationId: session.organizationId,
  });
  revalidatePath("/dashboard/marketplace/my-listings");
  revalidatePath("/dashboard/reservations");
  return serialize(result);
}

// ─── Settlement & atomic cross-org transfer ─────────────────────────────────

/**
 * Internal: copy the seller unit into the buyer org. Explicit field allow-list
 * (NO child relations). Intentionally bypasses the UNITS_MAX entitlement gate —
 * this is a system-initiated transfer, not user-initiated unit creation.
 */
async function cloneUnitForTransfer(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  sellerUnit: {
    id: string;
    number: string;
    type: "APARTMENT" | "VILLA" | "OFFICE" | "RETAIL" | "WAREHOUSE" | "PARKING";
    area: number | null;
    price: unknown;
    markupPrice: unknown;
    rentalPrice: unknown;
    floor: number | null;
    buildingName: string | null;
    addressLine: string | null;
    city: string | null;
    district: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
  },
  buyerOrgId: string,
  sellerOrgId: string,
) {
  return tx.unit.create({
    data: {
      number: sellerUnit.number,
      type: sellerUnit.type,
      status: "AVAILABLE",
      organizationId: buyerOrgId,
      area: sellerUnit.area ?? undefined,
      price: (sellerUnit.price as never) ?? undefined,
      markupPrice: (sellerUnit.markupPrice as never) ?? undefined,
      rentalPrice: (sellerUnit.rentalPrice as never) ?? undefined,
      floor: sellerUnit.floor ?? undefined,
      buildingName: sellerUnit.buildingName ?? undefined,
      addressLine: sellerUnit.addressLine ?? undefined,
      city: sellerUnit.city ?? undefined,
      district: sellerUnit.district ?? undefined,
      bedrooms: sellerUnit.bedrooms ?? undefined,
      bathrooms: sellerUnit.bathrooms ?? undefined,
      transferredFromUnitId: sellerUnit.id,
      transferredFromOrgId: sellerOrgId,
    },
  });
}

export async function settleMarketplaceTransfer(transferId: string) {
  const session = await requirePermission("marketplace:transfer:execute");

  const transfer = await db.unitTransferTransaction.findFirst({
    where: { id: transferId, sellerOrgId: session.organizationId },
    include: { inquiry: true },
  });
  if (!transfer) throw new Error("Transfer not found for your organization.");
  if (transfer.status === "COMPLETED") {
    throw new Error("This transfer has already been completed.");
  }
  if (transfer.status === "CANCELLED" || transfer.status === "FAILED") {
    throw new Error("This transfer cannot be settled in its current state.");
  }

  // Settlement gate: a SIGNED SALE contract must exist for the seller unit.
  const settledContract = await db.contract.findFirst({
    where: {
      unitId: transfer.sellerUnitId,
      type: "SALE",
      status: "SIGNED",
      customer: { organizationId: session.organizationId },
    },
    orderBy: { signedAt: "desc" },
  });
  if (!settledContract) {
    throw new Error(
      "Settlement requires a SIGNED sale contract for this unit before transfer.",
    );
  }

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_TRANSFER_STARTED",
    resource: "UnitTransferTransaction",
    resourceId: transferId,
    organizationId: session.organizationId,
  });

  try {
    const outcome = await db.$transaction(async (tx) => {
      const sellerUnit = await tx.unit.findFirst({
        where: { id: transfer.sellerUnitId, organizationId: transfer.sellerOrgId },
      });
      if (!sellerUnit) throw new Error("Seller unit no longer exists.");
      if (sellerUnit.transferredToOrgId) {
        throw new Error("Seller unit has already been transferred.");
      }

      const buyerUnit = await cloneUnitForTransfer(
        tx,
        sellerUnit,
        transfer.buyerOrgId,
        transfer.sellerOrgId,
      );

      await tx.unit.update({
        where: { id: sellerUnit.id },
        data: {
          status: "SOLD",
          marketplaceStatus: "SOLD_TRANSFERRED",
          transferredToOrgId: transfer.buyerOrgId,
          soldTransferredAt: new Date(),
          ownershipLockedReason: "Transferred to buyer organization via marketplace",
        },
      });
      await tx.marketplaceListing.update({
        where: { id: transfer.listingId },
        data: { status: "SOLD_TRANSFERRED" },
      });
      if (transfer.reservationId) {
        await tx.reservation.update({
          where: { id: transfer.reservationId },
          data: { status: "CONFIRMED" },
        });
      }
      await tx.marketplaceInquiry.update({
        where: { id: transfer.inquiryId },
        data: { status: "CLOSED_WON" },
      });

      // CAS: transition the transfer PENDING_SETTLEMENT → COMPLETED atomically.
      // The sellerUnit.transferredToOrgId sentinel (checked above) is the primary
      // idempotency guard; this CAS adds a second DB-level lock so a concurrent
      // settle attempt that passed the sentinel check before the tx committed will
      // also fail cleanly rather than double-completing.
      const transferClaim = await tx.unitTransferTransaction.updateMany({
        where: { id: transferId, status: "PENDING_SETTLEMENT" },
        data: {
          status: "COMPLETED",
          buyerUnitId: buyerUnit.id,
          contractId: settledContract.id,
          settledAt: new Date(),
          completedAt: new Date(),
        },
      });
      if (transferClaim.count === 0) {
        throw new Error("This transfer has already been completed.");
      }
      // Re-fetch for the return value (updateMany does not return the record).
      const completed = await tx.unitTransferTransaction.findUniqueOrThrow({
        where: { id: transferId },
      });

      // Transactional audit (NOT fire-and-forget) — ownership transfer is legal/financial.
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          userEmail: session.email,
          userRole: session.role,
          action: "MARKETPLACE_TRANSFER_COMPLETED",
          resource: "UnitTransferTransaction",
          resourceId: transferId,
          metadata: {
            sellerUnitId: sellerUnit.id,
            buyerUnitId: buyerUnit.id,
            sellerOrgId: transfer.sellerOrgId,
            buyerOrgId: transfer.buyerOrgId,
            contractId: settledContract.id,
          },
          organizationId: transfer.sellerOrgId,
        },
      });

      return { buyerUnitId: buyerUnit.id, sellerUnitId: sellerUnit.id, completed };
    });

    await notifyOrgAdmins(
      transfer.buyerOrgId,
      "MARKETPLACE_TRANSFER",
      "تم نقل ملكية الوحدة إليك",
      "Unit ownership transferred to you",
      `تمت إضافة الوحدة المنقولة إلى مخزونك.`,
      `The transferred unit has been added to your inventory.`,
      `/dashboard/units`,
    );
    await notifyOrgAdmins(
      transfer.sellerOrgId,
      "MARKETPLACE_TRANSFER",
      "اكتمل نقل الوحدة",
      "Unit transfer completed",
      `تم نقل ملكية الوحدة إلى المشتري بنجاح.`,
      `Unit ownership was successfully transferred to the buyer.`,
      `/dashboard/marketplace/my-listings`,
    );

    revalidatePath("/dashboard/marketplace/my-listings");
    revalidatePath("/dashboard/units");
    return serialize({ status: "COMPLETED", ...outcome });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown transfer failure";
    await db.unitTransferTransaction.update({
      where: { id: transferId },
      data: { status: "FAILED", failureReason: reason },
    });
    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "MARKETPLACE_TRANSFER_FAILED",
      resource: "UnitTransferTransaction",
      resourceId: transferId,
      metadata: { reason },
      organizationId: session.organizationId,
    });
    await notifyOrgAdmins(
      transfer.sellerOrgId,
      "MARKETPLACE_TRANSFER_FAILED",
      "فشل نقل الوحدة",
      "Unit transfer failed",
      `فشل نقل ملكية الوحدة. لا تزال الوحدة ملكك. السبب: ${reason}`,
      `Unit transfer failed. You remain the owner. Reason: ${reason}`,
      `/dashboard/marketplace/my-listings`,
    );
    throw new Error(
      `Transfer failed and was rolled back — you remain the owner. ${reason}`,
    );
  }
}

// ─── Platform moderation (system staff only) ────────────────────────────────

export async function listListingsForModeration() {
  await requirePermission("marketplace:moderate");
  const listings = await db.marketplaceListing.findMany({
    include: {
      sellerOrg: { select: { id: true, name: true, nameEnglish: true } },
      _count: { select: { inquiries: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return serialize(listings);
}

export async function moderateSuspendListing(listingId: string, reason: string) {
  const session = await requirePermission("marketplace:moderate");
  if (!reason?.trim()) throw new Error("A suspension reason is required.");

  const listing = await db.marketplaceListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error("Listing not found.");

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.marketplaceListing.update({
      where: { id: listingId },
      data: { status: "SUSPENDED", suspendedReason: reason.trim() },
    });
    await tx.unit.updateMany({
      where: { id: listing.unitId },
      data: { marketplaceStatus: "SUSPENDED" },
    });
    return result;
  });

  await notifyOrgAdmins(
    listing.sellerOrgId,
    "MARKETPLACE_SUSPENDED",
    "تم تعليق إعلانك",
    "Your listing was suspended",
    `تم تعليق إعلانك ${listing.listingNumber} من قبل إدارة المنصة. السبب: ${reason.trim()}`,
    `Your listing ${listing.listingNumber} was suspended by platform moderation. Reason: ${reason.trim()}`,
    `/dashboard/marketplace/my-listings`,
  );

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_LISTING_SUSPENDED",
    resource: "MarketplaceListing",
    resourceId: listingId,
    metadata: { reason },
    organizationId: listing.sellerOrgId,
  });
  revalidatePath("/dashboard/admin/marketplace");
  revalidatePath("/dashboard/marketplace");
  return serialize(updated);
}
