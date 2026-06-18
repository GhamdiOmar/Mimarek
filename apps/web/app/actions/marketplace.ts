"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { ROUTES } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import {
  listPublishedListingsForBuyer,
  getPublishedListingForBuyer,
  listSellerOrgsWithListings,
  type MarketplaceListingFilters,
} from "../../lib/marketplace/listing-view";
import { encryptCustomerData, safeDecryptField } from "../../lib/pii-crypto";
import { encrypt } from "../../lib/encryption";
import { normalizeSaudiPhoneE164 } from "../../lib/phone";
import { checkRateLimit } from "../../lib/rate-limit";
import { isSystemRole } from "../../lib/permissions";
import { isConveyanceEnabled } from "../../lib/marketplace/conveyance";
import { syncDealStageForUnit } from "../../lib/server/pipeline-sync";
import {
  isValidListingTransition,
  transitionTransfer,
} from "../../lib/marketplace/state-machine";

// Saudi National Address short code: 4 letters + 4 digits (e.g. "RRRA2929").
const SHORT_ADDRESS_RE = /^[A-Z]{4}\d{4}$/;

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
  revalidatePath(ROUTES.marketplaceMyListings);
  revalidatePath(ROUTES.units);
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

    // A seller can NEVER self-publish/self-approve. Submitting always lands the
    // listing in PENDING_REVIEW (compliance PENDING_REVIEW too); only platform
    // moderation (moderateApproveListing) can take it PENDING_REVIEW → PUBLISHED
    // / complianceStatus APPROVED. This closes the self-approve bug where an
    // adLicenseNumber on the payload auto-approved the listing.
    const result = await tx.marketplaceListing.update({
      where: { id: listingId },
      data: {
        status: "PENDING_REVIEW",
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        price: payload.price,
        shortAddress: shortAddr,
        adLicenseNumber: payload.adLicenseNumber?.trim() || null,
        buildingAge: payload.buildingAge ?? null,
        complianceStatus: "PENDING_REVIEW",
        expiresAt,
        unpublishedReason: null,
      },
    });
    await tx.unit.update({
      where: { id: listing.unitId },
      data: { marketplaceStatus: "PENDING_REVIEW", currentMarketplaceListingId: listingId },
    });
    return result;
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_LISTING_SUBMITTED",
    resource: "MarketplaceListing",
    resourceId: listingId,
    organizationId: session.organizationId,
  });
  revalidatePath(ROUTES.marketplace);
  revalidatePath(ROUTES.marketplaceMyListings);
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
  revalidatePath(ROUTES.marketplaceMyListings);
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
  revalidatePath(ROUTES.marketplaceMyListings);
  revalidatePath(ROUTES.marketplace);
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
      transfer: {
        select: {
          id: true,
          status: true,
          // Deed-proof status lets the seller UI show PENDING/VERIFIED/REJECTED
          // and decide whether to offer "Submit deed proof" vs "Settle". No PII
          // is selected here — only the proof's lifecycle status.
          deedProof: { select: { status: true } },
        },
      },
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

  // ── Rate limiting (QA-SEC-07) ─────────────────────────────────────────────
  // Per-org: 10 inquiries / hour (prevents bulk spam from a single tenant).
  const orgRl = await checkRateLimit(
    `mkt-inquiry:${session.organizationId}`,
    10,
    3600000,
  );
  if (!orgRl.allowed) {
    throw new Error(
      "Too many inquiries. Please try again later. " +
        "عدد كبير من الاستفسارات، حاول لاحقاً.",
    );
  }
  // Per-(org, listing): 3 inquiries / day (prevents re-submitting the same listing).
  const listingRl = await checkRateLimit(
    `mkt-inquiry:${session.organizationId}:${listingId}`,
    3,
    86400000,
  );
  if (!listingRl.allowed) {
    throw new Error(
      "Too many inquiries. Please try again later. " +
        "عدد كبير من الاستفسارات، حاول لاحقاً.",
    );
  }

  // Validate and normalize the contact phone (required — seller needs a real callback number).
  const normalizedPhone = normalizeSaudiPhoneE164(payload.contactPhone);
  if (!normalizedPhone) {
    throw new Error(
      "A valid Saudi mobile number is required to submit an inquiry (e.g. 05XXXXXXXX). " +
        "يجب إدخال رقم جوال سعودي صحيح لإرسال الاستفسار (مثال: 05XXXXXXXX).",
    );
  }

  const result = await db.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.findFirst({
      where: { id: listingId, status: "PUBLISHED" },
    });
    if (!listing) throw new Error("This listing is no longer available.");
    if (listing.sellerOrgId === session.organizationId) {
      throw new Error("You cannot express interest in your own organization's listing.");
    }

    // Encrypt the normalized phone for the seller-side CRM customer. The blind-index
    // hash is keyed to the SELLER org (the customer's owning org) — H8 per-tenant.
    const encryptedPhone = encryptCustomerData({ phone: normalizedPhone }, listing.sellerOrgId);

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
  revalidatePath(ROUTES.marketplace);
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
  revalidatePath(ROUTES.marketplace);
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

    // ── I5: explicit idempotency guard ───────────────────────────────────────
    // If this inquiry has already been converted (terminal state for this op),
    // a double-submit/retry must be a provable no-op — return the existing
    // reservation + transfer instead of re-running the claim+create path (which
    // would otherwise either throw a misleading "Unit no longer available" or, if
    // a CAS slipped, materialize a second deal). This makes the convert step
    // idempotent at the inquiry level, complementing the per-step CAS guards.
    if (inquiry.status === "CONVERTED_TO_DEAL") {
      const existingTransfer = await tx.unitTransferTransaction.findFirst({
        where: { inquiryId: inquiry.id },
        orderBy: { createdAt: "desc" },
      });
      const existingReservation = existingTransfer?.reservationId
        ? await tx.reservation.findUnique({ where: { id: existingTransfer.reservationId } })
        : null;
      return {
        reservation: existingReservation,
        transfer: existingTransfer,
        inquiry,
        buyerOrgId: inquiry.buyerOrgId,
        listingNumber: inquiry.listing.listingNumber,
        alreadyConverted: true as const,
        customerId: inquiry.sellerCrmCustomerId,
        unitId: inquiry.listing.unitId,
      };
    }
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
        // Tenant owner of the reservation is the SELLER org (it owns the unit).
        // The session user is the seller-org staff converting the inquiry, so
        // session.organizationId === inquiry.sellerOrgId here; use sellerOrgId
        // explicitly so the owning org is unambiguous and matches sellerOrgId below.
        organizationId: inquiry.sellerOrgId,
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

    // I4: do NOT write Customer.status directly here. Pipeline state is owned by
    // the Deal entity (R3 — Customer.status is a derived cache). The direct
    // write bypassed the Deal-sync state machine, so any concurrent Deal-sync
    // (which recomputes Customer.status from Deal rows, where this path created
    // NO deal) would silently clobber the "RESERVED" status. Instead we advance
    // the deal to RESERVED via syncDealStageForUnit AFTER the tx commits (that
    // helper uses the global `db` client and must not run inside a tx — same
    // pattern as reservations.ts / contracts.ts), and the customer status is
    // derived from it. A concurrent Deal-sync then recomputes the SAME RESERVED
    // value rather than overwriting an orphaned direct write.
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
    return {
      reservation,
      transfer,
      inquiry: updatedInquiry,
      buyerOrgId: inquiry.buyerOrgId,
      listingNumber: inquiry.listing.listingNumber,
      alreadyConverted: false as const,
      // Carried out of the tx so the post-tx Deal-sync (R3) can advance the
      // pipeline deal to RESERVED and let Customer.status derive from it.
      customerId: inquiry.sellerCrmCustomerId,
      unitId: unit.id,
    };
  });

  // ── I5: idempotent short-circuit ──────────────────────────────────────────
  // A retry/double-submit landed on an already-converted inquiry; the tx did no
  // writes. Skip the side effects (pipeline-sync / notify / audit / revalidate)
  // and return the existing reservation+transfer so the call is a provable no-op.
  if (result.alreadyConverted) {
    return serialize(result);
  }

  // ── I4: route the pipeline status change through the Deal entity (R3). ─────
  // Advance (or materialize) the customer's deal for this unit to RESERVED;
  // Customer.status is then derived from it. Runs AFTER the tx commits because
  // syncDealStageForUnit uses the global `db` client (running it inside the tx
  // would create nested-transaction issues — the same constraint honored by
  // reservations.ts:78 and contracts.ts:422). A sync failure must not undo the
  // committed conversion, so it stays out of the tx like every other sync site.
  if (result.customerId) {
    await syncDealStageForUnit(result.customerId, result.unitId, "RESERVED");
  }

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
  revalidatePath(ROUTES.marketplaceMyListings);
  revalidatePath(ROUTES.reservations);
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
    include: { inquiry: true, deedProof: true },
  });
  if (!transfer) throw new Error("Transfer not found for your organization.");
  if (transfer.status === "COMPLETED") {
    throw new Error("This transfer has already been completed.");
  }
  if (transfer.status === "CANCELLED" || transfer.status === "FAILED") {
    throw new Error("This transfer cannot be settled in its current state.");
  }

  // ── Gate 1: conveyance kill-switch (UNCACHED, fail-closed). ────────────────
  // The whole reserve-and-buy rail ships DARK behind this flag. Checked here
  // (early reject) AND re-read inside the transaction (TOCTOU — Gate 6).
  if (!(await isConveyanceEnabled())) {
    logAuditEvent({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: "MARKETPLACE_TRANSFER_BLOCKED",
      resource: "UnitTransferTransaction",
      resourceId: transferId,
      metadata: { reason: "conveyance_disabled" },
      organizationId: session.organizationId,
    });
    throw new Error("Marketplace conveyance is currently disabled on this platform.");
  }

  // ── Gate 2: a SIGNED SALE contract must exist for the seller unit. ─────────
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

  // ── Gate 3: the deed-transfer proof must be VERIFIED by platform staff. ────
  if (transfer.deedProof?.status !== "VERIFIED") {
    throw new Error("Deed-transfer proof must be verified before settlement.");
  }

  // ── Gate 4: both the seller and buyer org must be REGA-verified. ───────────
  const [sellerAuth, buyerAuth] = await Promise.all([
    db.orgRegaAuthorization.findUnique({ where: { organizationId: transfer.sellerOrgId } }),
    db.orgRegaAuthorization.findUnique({ where: { organizationId: transfer.buyerOrgId } }),
  ]);
  if (sellerAuth?.status !== "VERIFIED" || buyerAuth?.status !== "VERIFIED") {
    throw new Error("Both organizations must be REGA-verified before settlement.");
  }

  // ── Gate 5: the transfer must be in READY (set by verifyDeedTransferProof). ─
  if (transfer.status !== "READY") {
    throw new Error("Transfer is not ready for settlement — deed proof must be verified first.");
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
      // ── Gate 6: re-read the kill-switch INSIDE the tx (TOCTOU). ─────────────
      // A platform admin may have flipped conveyance OFF between the early gate
      // and here; this aborts + rolls back the whole settlement.
      if (!(await isConveyanceEnabled())) {
        throw new Error("Conveyance disabled mid-settlement.");
      }

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

      // CAS: transition the transfer READY → COMPLETED atomically (via the shared
      // state-machine helper). READY was set by verifyDeedTransferProof; the
      // sellerUnit.transferredToOrgId sentinel (checked above) is the primary
      // idempotency guard, and this CAS adds a second DB-level lock so a concurrent
      // settle attempt that passed the sentinel check before the tx committed will
      // also fail cleanly rather than double-completing.
      const completed = await transitionTransfer(tx, transferId, "READY", "COMPLETED", {
        buyerUnitId: buyerUnit.id,
        contractId: settledContract.id,
        settledAt: new Date(),
        completedAt: new Date(),
      });
      if (completed.status !== "COMPLETED") {
        throw new Error("This transfer has already been completed.");
      }

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

    revalidatePath(ROUTES.marketplaceMyListings);
    revalidatePath(ROUTES.units);
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
  revalidatePath(ROUTES.adminMarketplace);
  revalidatePath(ROUTES.marketplace);
  return serialize(updated);
}

// ─── P3: Platform moderation — approve / reject (PENDING_REVIEW gate) ────────

export async function moderateApproveListing(listingId: string) {
  const session = await requirePermission("marketplace:moderate");

  const updated = await db.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new Error("Listing not found.");
    if (!isValidListingTransition(listing.status, "PUBLISHED")) {
      throw new Error("Only listings pending review can be approved.");
    }

    const result = await tx.marketplaceListing.update({
      where: { id: listingId },
      data: {
        status: "PUBLISHED",
        complianceStatus: "APPROVED",
        publishedAt: new Date(),
        rejectedReason: null,
      },
    });
    await tx.unit.updateMany({
      where: { id: listing.unitId },
      data: { marketplaceStatus: "PUBLISHED" },
    });

    // Transactional audit — moderation approval is a compliance decision.
    await tx.auditLog.create({
      data: {
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        action: "MARKETPLACE_LISTING_APPROVED",
        resource: "MarketplaceListing",
        resourceId: listingId,
        organizationId: listing.sellerOrgId,
      },
    });
    return result;
  });

  await notifyOrgAdmins(
    updated.sellerOrgId,
    "MARKETPLACE_APPROVED",
    "تم اعتماد إعلانك",
    "Your listing was approved",
    `تم اعتماد إعلانك ${updated.listingNumber} ونُشر في السوق.`,
    `Your listing ${updated.listingNumber} was approved and published to the marketplace.`,
    `/dashboard/marketplace/my-listings`,
  );

  revalidatePath(ROUTES.adminMarketplace);
  revalidatePath(ROUTES.marketplace);
  revalidatePath(ROUTES.marketplaceMyListings);
  return serialize(updated);
}

export async function moderateRejectListing(listingId: string, reason: string) {
  const session = await requirePermission("marketplace:moderate");
  if (!reason?.trim()) throw new Error("A rejection reason is required.");

  const updated = await db.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new Error("Listing not found.");
    if (!isValidListingTransition(listing.status, "REJECTED")) {
      throw new Error("Only listings pending review can be rejected.");
    }

    const result = await tx.marketplaceListing.update({
      where: { id: listingId },
      data: {
        status: "REJECTED",
        complianceStatus: "REJECTED",
        rejectedReason: reason.trim(),
      },
    });
    await tx.unit.updateMany({
      where: { id: listing.unitId },
      data: { marketplaceStatus: "REJECTED" },
    });

    await tx.auditLog.create({
      data: {
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        action: "MARKETPLACE_LISTING_REJECTED",
        resource: "MarketplaceListing",
        resourceId: listingId,
        metadata: { reason: reason.trim() },
        organizationId: listing.sellerOrgId,
      },
    });
    return result;
  });

  await notifyOrgAdmins(
    updated.sellerOrgId,
    "MARKETPLACE_REJECTED",
    "تم رفض إعلانك",
    "Your listing was rejected",
    `تم رفض إعلانك ${updated.listingNumber}. السبب: ${reason.trim()}`,
    `Your listing ${updated.listingNumber} was rejected. Reason: ${reason.trim()}`,
    `/dashboard/marketplace/my-listings`,
  );

  revalidatePath(ROUTES.adminMarketplace);
  revalidatePath(ROUTES.marketplaceMyListings);
  return serialize(updated);
}

// ─── P3: Org REGA / FAL authorization (self-assert → staff verify) ──────────

export type OrgRegaSubmitPayload = {
  regaLicenseNumber?: string;
  isSeller?: boolean;
  isBuyer?: boolean;
};

export async function submitOrgRegaAuthorization(payload: OrgRegaSubmitPayload) {
  const session = await requirePermission("marketplace:publish");

  const result = await db.orgRegaAuthorization.upsert({
    where: { organizationId: session.organizationId },
    create: {
      organizationId: session.organizationId,
      regaLicenseNumber: payload.regaLicenseNumber?.trim() || null,
      isSeller: payload.isSeller ?? false,
      isBuyer: payload.isBuyer ?? false,
      status: "SELF_ASSERTED",
      method: "MANUAL_ATTESTATION",
    },
    update: {
      regaLicenseNumber: payload.regaLicenseNumber?.trim() || null,
      isSeller: payload.isSeller ?? false,
      isBuyer: payload.isBuyer ?? false,
      // Re-submission resets verification — staff must re-verify any change.
      status: "SELF_ASSERTED",
      verifiedByUserId: null,
      verifiedAt: null,
      rejectedReason: null,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "ORG_REGA_SUBMITTED",
    resource: "OrgRegaAuthorization",
    resourceId: result.id,
    metadata: { isSeller: result.isSeller, isBuyer: result.isBuyer },
    organizationId: session.organizationId,
  });
  revalidatePath(ROUTES.marketplaceMyListings);
  return serialize(result);
}

export async function verifyOrgRegaAuthorization(
  organizationId: string,
  payload: { approve: boolean; reason?: string },
) {
  const session = await requirePermission("marketplace:moderate");
  if (!payload.approve && !payload.reason?.trim()) {
    throw new Error("A rejection reason is required.");
  }

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.orgRegaAuthorization.findUnique({ where: { organizationId } });
    if (!existing) throw new Error("No REGA authorization on file for this organization.");

    const updated = await tx.orgRegaAuthorization.update({
      where: { organizationId },
      data: {
        status: payload.approve ? "VERIFIED" : "REJECTED",
        method: "MANUAL_ATTESTATION",
        verifiedByUserId: session.userId,
        verifiedAt: new Date(),
        rejectedReason: payload.approve ? null : payload.reason?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        action: payload.approve ? "ORG_REGA_VERIFIED" : "ORG_REGA_REJECTED",
        resource: "OrgRegaAuthorization",
        resourceId: updated.id,
        metadata: payload.approve ? {} : { reason: payload.reason?.trim() },
        organizationId,
      },
    });
    return updated;
  });

  revalidatePath(ROUTES.adminMarketplace);
  return serialize(result);
}

export async function getMyOrgRegaAuthorization() {
  const session = await requirePermission("marketplace:manage_own");
  const auth = await db.orgRegaAuthorization.findUnique({
    where: { organizationId: session.organizationId },
  });
  return auth ? serialize(auth) : null;
}

export async function listOrgRegaAuthorizations() {
  await requirePermission("marketplace:moderate");
  const rows = await db.orgRegaAuthorization.findMany({
    include: { organization: { select: { id: true, name: true, nameEnglish: true } } },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  return serialize(rows);
}

// ─── P3: Deed-transfer proof (encrypted PII → staff verify → READY) ─────────

export type DeedProofSubmitPayload = {
  deedNumber?: string;
  ownerNationalId?: string;
  deedDocUrl?: string;
  deedDocHash?: string;
  rettCertRef?: string;
};

export async function submitDeedTransferProof(
  transferId: string,
  payload: DeedProofSubmitPayload,
) {
  const session = await requirePermission("marketplace:transfer:execute");

  // The transfer must belong to the seller org submitting the proof.
  const transfer = await db.unitTransferTransaction.findFirst({
    where: { id: transferId, sellerOrgId: session.organizationId },
    select: { id: true },
  });
  if (!transfer) throw new Error("Transfer not found for your organization.");

  // Encrypt the two highly-sensitive PII fields — NEVER store/log plaintext.
  const deedNumberEnc = payload.deedNumber?.trim()
    ? encrypt(payload.deedNumber.trim())
    : null;
  const ownerNationalIdEnc = payload.ownerNationalId?.trim()
    ? encrypt(payload.ownerNationalId.trim())
    : null;

  const result = await db.marketplaceDeedProof.upsert({
    where: { transferId },
    create: {
      transferId,
      deedNumberEnc,
      ownerNationalIdEnc,
      deedDocUrl: payload.deedDocUrl?.trim() || null,
      deedDocHash: payload.deedDocHash?.trim() || null,
      rettCertRef: payload.rettCertRef?.trim() || null,
      status: "PENDING",
      method: "MANUAL_ATTESTATION",
      submittedAt: new Date(),
    },
    update: {
      deedNumberEnc,
      ownerNationalIdEnc,
      deedDocUrl: payload.deedDocUrl?.trim() || null,
      deedDocHash: payload.deedDocHash?.trim() || null,
      rettCertRef: payload.rettCertRef?.trim() || null,
      // Re-submission resets verification.
      status: "PENDING",
      verifiedByUserId: null,
      verifiedAt: null,
      rejectedReason: null,
      submittedAt: new Date(),
    },
  });

  // Audit metadata MUST NOT contain the plaintext deed number / national ID.
  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "DEED_PROOF_SUBMITTED",
    resource: "MarketplaceDeedProof",
    resourceId: result.id,
    metadata: { transferId, hasDeedDoc: !!result.deedDocUrl, hasRettCert: !!result.rettCertRef },
    organizationId: session.organizationId,
  });
  revalidatePath(ROUTES.marketplaceMyListings);
  return serialize(result);
}

export async function verifyDeedTransferProof(
  transferId: string,
  payload: { approve: boolean; reason?: string },
) {
  const session = await requirePermission("marketplace:moderate");
  if (!payload.approve && !payload.reason?.trim()) {
    throw new Error("A rejection reason is required.");
  }

  const result = await db.$transaction(async (tx) => {
    const proof = await tx.marketplaceDeedProof.findUnique({ where: { transferId } });
    if (!proof) throw new Error("No deed-transfer proof on file for this transfer.");

    const updated = await tx.marketplaceDeedProof.update({
      where: { transferId },
      data: {
        status: payload.approve ? "VERIFIED" : "REJECTED",
        method: "MANUAL_ATTESTATION",
        verifiedByUserId: session.userId,
        verifiedAt: new Date(),
        rejectedReason: payload.approve ? null : payload.reason?.trim() || null,
      },
    });

    // On approval, advance the transfer PENDING_SETTLEMENT → READY so settlement
    // can claim READY → COMPLETED. transitionTransfer is idempotent + validating.
    if (payload.approve) {
      await transitionTransfer(tx, transferId, "PENDING_SETTLEMENT", "READY");
    }

    await tx.auditLog.create({
      data: {
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        action: payload.approve ? "DEED_PROOF_VERIFIED" : "DEED_PROOF_REJECTED",
        resource: "MarketplaceDeedProof",
        resourceId: updated.id,
        // No plaintext PII in metadata.
        metadata: payload.approve ? { transferId } : { transferId, reason: payload.reason?.trim() },
        organizationId: null,
      },
    });
    return updated;
  });

  revalidatePath(ROUTES.adminMarketplace);
  revalidatePath(ROUTES.marketplaceMyListings);
  return serialize(result);
}

/**
 * Decrypt the deed proof for the verifier view (deed number + owner national-ID).
 * Visible to platform staff (marketplace:moderate) OR the seller org that owns
 * the underlying transfer. Decryption degrades gracefully via safeDecryptField.
 */
export async function getDeedProofForTransfer(transferId: string) {
  const session = await requirePermission("marketplace:transfer:execute");

  const proof = await db.marketplaceDeedProof.findUnique({
    where: { transferId },
    include: { transfer: { select: { sellerOrgId: true, buyerOrgId: true } } },
  });
  if (!proof) return null;

  // Audience scope: platform staff see any proof; tenant users only their own
  // org's transfer (seller side owns deed submission).
  const isSystem = isSystemRole(session.role);
  if (!isSystem && proof.transfer.sellerOrgId !== session.organizationId) {
    throw new Error("Deed proof not found for your organization.");
  }

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "READ_PII",
    resource: "MarketplaceDeedProof",
    resourceId: proof.id,
    metadata: { transferId },
    organizationId: session.organizationId,
  });

  return serialize({
    id: proof.id,
    transferId: proof.transferId,
    status: proof.status,
    method: proof.method,
    deedNumber: proof.deedNumberEnc ? safeDecryptField(proof.deedNumberEnc, "deedNumber") : null,
    ownerNationalId: proof.ownerNationalIdEnc
      ? safeDecryptField(proof.ownerNationalIdEnc, "ownerNationalId")
      : null,
    deedDocUrl: proof.deedDocUrl,
    deedDocHash: proof.deedDocHash,
    rettCertRef: proof.rettCertRef,
    verifiedByUserId: proof.verifiedByUserId,
    verifiedAt: proof.verifiedAt,
    rejectedReason: proof.rejectedReason,
    submittedAt: proof.submittedAt,
  });
}

/**
 * List the transfers that carry a deed proof awaiting platform review (status
 * PENDING). Platform staff only (marketplace:moderate). Returns NO decrypted PII
 * — the verifier opens an individual proof via getDeedProofForTransfer (which
 * audits the READ_PII). This is the deed-proofs moderation queue.
 */
export async function listPendingDeedProofs() {
  await requirePermission("marketplace:moderate");
  const proofs = await db.marketplaceDeedProof.findMany({
    where: { status: "PENDING" },
    include: {
      transfer: {
        select: {
          id: true,
          status: true,
          sellerOrg: { select: { id: true, name: true, nameEnglish: true } },
          buyerOrg: { select: { id: true, name: true, nameEnglish: true } },
          listing: { select: { id: true, listingNumber: true, title: true } },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 300,
  });
  // Strip the encrypted PII columns — the queue shows metadata only.
  return serialize(
    proofs.map((p) => ({
      id: p.id,
      transferId: p.transferId,
      status: p.status,
      deedDocUrl: p.deedDocUrl,
      rettCertRef: p.rettCertRef,
      submittedAt: p.submittedAt,
      transfer: p.transfer,
    })),
  );
}

// ─── P3: Legal-gate kill-switch (SYSTEM_ADMIN only) ─────────────────────────

export async function setMarketplaceConveyanceEnabled(payload: {
  enabled: boolean;
  note?: string;
}) {
  const session = await requirePermission("marketplace:moderate");
  // marketplace:moderate is SYSTEM_ONLY, but assert the system role explicitly —
  // flipping the irreversible-conveyance kill-switch is a SYSTEM_ADMIN duty and
  // must never be reachable by a tenant role (defense-in-depth vs. matrix drift).
  if (!isSystemRole(session.role)) {
    throw new Error("Only platform administrators can change the conveyance setting.");
  }

  const result = await db.systemConfig.update({
    where: { id: "system" },
    data: {
      marketplaceConveyanceEnabled: payload.enabled,
      marketplaceLegalSignoffBy: session.email,
      marketplaceLegalSignoffAt: new Date(),
      marketplaceLegalSignoffNote: payload.note?.trim() || null,
    },
    select: {
      marketplaceConveyanceEnabled: true,
      marketplaceLegalSignoffBy: true,
      marketplaceLegalSignoffAt: true,
      marketplaceLegalSignoffNote: true,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "MARKETPLACE_CONVEYANCE_TOGGLED",
    resource: "SystemConfig",
    resourceId: "system",
    metadata: { enabled: payload.enabled, note: payload.note?.trim() || null },
    organizationId: null,
  });
  revalidatePath(ROUTES.adminMarketplace);
  return serialize(result);
}

export async function getMarketplaceConveyanceConfig() {
  await requirePermission("marketplace:moderate");
  const config = await db.systemConfig.findUnique({
    where: { id: "system" },
    select: {
      marketplaceConveyanceEnabled: true,
      marketplaceLegalSignoffBy: true,
      marketplaceLegalSignoffAt: true,
      marketplaceLegalSignoffNote: true,
      regaPlatformFalLicense: true,
    },
  });
  return config ? serialize(config) : null;
}
