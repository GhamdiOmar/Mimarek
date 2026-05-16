/**
 * Marketplace cross-org read isolation layer.
 *
 * THIS IS THE ONLY PLACE the tenant org filter is deliberately relaxed.
 * Every function here returns an explicit allow-listed view model — never a
 * raw `MarketplaceListing`/`Unit`/`Customer`/`Contract` row. Cross-tenant data
 * isolation depends on this file: do not add fields to the VMs that expose
 * seller-internal data (cost price, customer, contracts, notes, raw unitId).
 *
 * Callers (server actions) are responsible for auth/permission; these helpers
 * take an explicit viewerOrgId and enforce the buyer-visibility rules.
 */
import { db } from "@repo/db";

export type MarketplaceListingCardVM = {
  id: string;
  listingNumber: string;
  title: string | null;
  price: number | null;
  area: number | null;
  city: string | null;
  district: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  buildingAge: number | null;
  sellerOrgId: string;
  sellerOrgName: string | null;
  publishedAt: string | null;
  viewCount: number;
};

export type MarketplaceListingDetailVM = MarketplaceListingCardVM & {
  description: string | null;
  shortAddress: string | null;
  complianceStatus: string;
  adLicenseNumber: string | null;
  interestCount: number;
  status: string;
};

export type MarketplaceListingFilters = {
  city?: string;
  district?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  sellerOrgId?: string;
  bedrooms?: number;
  maxBuildingAge?: number;
  q?: string;
};

type SellerSnapshot = { name?: string; nameArabic?: string; nameEnglish?: string };

function sellerName(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as SellerSnapshot;
  return s.nameEnglish ?? s.name ?? s.nameArabic ?? null;
}

function toCardVM(listing: {
  id: string;
  listingNumber: string;
  title: string | null;
  price: unknown;
  area: number | null;
  city: string | null;
  district: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  buildingAge: number | null;
  sellerOrgId: string;
  sellerOrgSnapshot: unknown;
  publishedAt: Date | null;
  viewCount: number;
}): MarketplaceListingCardVM {
  return {
    id: listing.id,
    listingNumber: listing.listingNumber,
    title: listing.title,
    price: listing.price == null ? null : Number(listing.price),
    area: listing.area,
    city: listing.city,
    district: listing.district,
    propertyType: listing.propertyType,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    buildingAge: listing.buildingAge,
    sellerOrgId: listing.sellerOrgId,
    sellerOrgName: sellerName(listing.sellerOrgSnapshot),
    publishedAt: listing.publishedAt ? listing.publishedAt.toISOString() : null,
    viewCount: listing.viewCount,
  };
}

const CARD_SELECT = {
  id: true,
  listingNumber: true,
  title: true,
  price: true,
  area: true,
  city: true,
  district: true,
  propertyType: true,
  bedrooms: true,
  bathrooms: true,
  buildingAge: true,
  sellerOrgId: true,
  sellerOrgSnapshot: true,
  publishedAt: true,
  viewCount: true,
} as const;

/** A listing is buyer-visible only if PUBLISHED, not expired, not suspended. */
function buyerVisibleWhere(viewerOrgId: string) {
  return {
    status: "PUBLISHED" as const,
    sellerOrgId: { not: viewerOrgId },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

export async function listPublishedListingsForBuyer(
  viewerOrgId: string,
  filters: MarketplaceListingFilters = {},
): Promise<MarketplaceListingCardVM[]> {
  const where: Record<string, unknown> = { ...buyerVisibleWhere(viewerOrgId) };

  if (filters.city) where.city = filters.city;
  if (filters.district) where.district = filters.district;
  if (filters.propertyType) where.propertyType = filters.propertyType;
  if (filters.sellerOrgId) where.sellerOrgId = filters.sellerOrgId;
  if (filters.bedrooms != null) where.bedrooms = { gte: filters.bedrooms };
  if (filters.maxBuildingAge != null) where.buildingAge = { lte: filters.maxBuildingAge };
  if (filters.minPrice != null || filters.maxPrice != null) {
    where.price = {
      ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
    };
  }
  if (filters.minArea != null || filters.maxArea != null) {
    where.area = {
      ...(filters.minArea != null ? { gte: filters.minArea } : {}),
      ...(filters.maxArea != null ? { lte: filters.maxArea } : {}),
    };
  }
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { city: { contains: filters.q, mode: "insensitive" } },
      { district: { contains: filters.q, mode: "insensitive" } },
    ];
    // Keep visibility OR (expiry) intact via AND.
    where.AND = [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }];
    delete (where as { OR?: unknown; expiresAt?: unknown }).expiresAt;
  }

  const rows = await db.marketplaceListing.findMany({
    where: where as never,
    select: CARD_SELECT,
    orderBy: { publishedAt: "desc" },
    take: 200,
  });
  return rows.map(toCardVM);
}

/**
 * Single listing for a buyer. Returns null if not buyer-visible.
 * Increments viewCount as a side effect (best-effort).
 */
export async function getPublishedListingForBuyer(
  viewerOrgId: string,
  listingId: string,
): Promise<MarketplaceListingDetailVM | null> {
  const listing = await db.marketplaceListing.findFirst({
    where: { id: listingId, ...buyerVisibleWhere(viewerOrgId) } as never,
    select: {
      ...CARD_SELECT,
      description: true,
      shortAddress: true,
      complianceStatus: true,
      adLicenseNumber: true,
      interestCount: true,
      status: true,
    },
  });
  if (!listing) return null;

  void db.marketplaceListing
    .update({ where: { id: listingId }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return {
    ...toCardVM(listing),
    description: listing.description,
    shortAddress: listing.shortAddress,
    complianceStatus: listing.complianceStatus,
    adLicenseNumber: listing.adLicenseNumber,
    interestCount: listing.interestCount,
    status: listing.status,
  };
}

/** Distinct seller orgs that currently have buyer-visible listings (for filter UI). */
export async function listSellerOrgsWithListings(
  viewerOrgId: string,
): Promise<{ id: string; name: string | null }[]> {
  const rows = await db.marketplaceListing.findMany({
    where: buyerVisibleWhere(viewerOrgId) as never,
    select: { sellerOrgId: true, sellerOrgSnapshot: true },
    distinct: ["sellerOrgId"],
    take: 100,
  });
  return rows.map((r) => ({ id: r.sellerOrgId, name: sellerName(r.sellerOrgSnapshot) }));
}
