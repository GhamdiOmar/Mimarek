import type { ComponentProps } from "react";
import { requirePermission } from "../../../lib/auth-helpers";
import {
  browseMarketplaceListings,
  getMarketplaceSellerOrgFilters,
} from "../../actions/marketplace";
import MarketplaceView from "./MarketplaceView";

/**
 * Marketplace — Server Component (CX-003 pt1). The browse fetch is URL-filter
 * driven, so this shell reads `searchParams` and fetches the first page with
 * them (mirrors the client `loadListings`), then the client island re-fetches
 * only on subsequent filter changes (first-run skipped). Permission matches
 * `browseMarketplaceListings` (`marketplace:read`). Inquiries stay lazily
 * loaded in the island (own tab). The interactive body lives in MarketplaceView.
 */
type SearchParamsShape = Record<string, string | undefined>;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  await requirePermission("marketplace:read");
  const sp = await searchParams;
  const num = (v?: string) => (v ? Number(v) : undefined);

  const [initialListings, initialSellerOrgs] = await Promise.all([
    browseMarketplaceListings({
      q: sp.q || undefined,
      city: sp.city || undefined,
      district: sp.district || undefined,
      propertyType: sp.propertyType || undefined,
      minPrice: num(sp.minPrice),
      maxPrice: num(sp.maxPrice),
      minArea: num(sp.minArea),
      maxArea: num(sp.maxArea),
      sellerOrgId: sp.sellerOrgId || undefined,
      bedrooms: num(sp.bedrooms),
      maxBuildingAge: num(sp.maxBuildingAge),
    }),
    getMarketplaceSellerOrgFilters(),
  ]);

  return (
    <MarketplaceView
      initialListings={
        initialListings as unknown as ComponentProps<
          typeof MarketplaceView
        >["initialListings"]
      }
      initialSellerOrgs={
        initialSellerOrgs as unknown as ComponentProps<
          typeof MarketplaceView
        >["initialSellerOrgs"]
      }
    />
  );
}
