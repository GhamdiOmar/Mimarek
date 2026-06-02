"use client";

import * as React from "react";
import {
  Search,
  Store,
  BedDouble,
  MapPin,
  Building2,
  SlidersHorizontal,
  X,
  Eye,
  Inbox,
  Loader2,
  AlertCircle,
  Handshake,
  Tags,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageIntro,
  ResponsiveDialog,
  EmptyState,
  Skeleton,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "../../../components/LanguageProvider";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  browseMarketplaceListings,
  getMarketplaceSellerOrgFilters,
  listMyMarketplaceInquiries,
  withdrawMarketplaceInquiry,
} from "../../actions/marketplace";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { MarketplaceListingCardVM } from "../../../lib/marketplace/listing-view";

// ─── Types ───────────────────────────────────────────────────────────────────

type Inquiry = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  listing: {
    id: string;
    listingNumber: string;
    title: string | null;
    price: number | null;
    city: string | null;
    status: string;
  };
  transfer: { id: string; status: string } | null;
};

// ─── Labels ──────────────────────────────────────────────────────────────────

const PROPERTY_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  APARTMENT: { ar: "شقة", en: "Apartment" },
  VILLA: { ar: "فيلا", en: "Villa" },
  OFFICE: { ar: "مكتب", en: "Office" },
  RETAIL: { ar: "محل تجاري", en: "Retail" },
  WAREHOUSE: { ar: "مستودع", en: "Warehouse" },
  PARKING: { ar: "موقف", en: "Parking" },
};

const INQUIRY_STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-info/15 text-info",
  WITHDRAWN: "bg-muted text-muted-foreground",
  CONVERTED_TO_DEAL: "bg-success/15 text-success",
  CLOSED_WON: "bg-success/15 text-success",
  CLOSED_LOST: "bg-destructive/15 text-destructive",
};

const INQUIRY_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  OPEN: { ar: "مفتوح", en: "Open" },
  WITHDRAWN: { ar: "مسحوب", en: "Withdrawn" },
  CONVERTED_TO_DEAL: { ar: "صفقة نشطة", en: "Active Deal" },
  CLOSED_WON: { ar: "مكتمل", en: "Completed" },
  CLOSED_LOST: { ar: "مغلق", en: "Closed" },
};

// ─── SAR formatter ────────────────────────────────────────────────────────────

function formatSARLocal(amount: number | null, lang: "ar" | "en") {
  if (amount == null) return "—";
  return new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Page wrapper (needed for useSearchParams) ────────────────────────────────

export default function MarketplacePageWrapper() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-[calc(100vh-200px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <MarketplacePage />
    </React.Suspense>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function MarketplacePage() {
  const { lang } = useLanguage();
  const { can } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab: "browse" | "inquiries"
  const [activeTab, setActiveTab] = React.useState<"browse" | "inquiries">("browse");

  // Filter state — synced with URL
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [city, setCity] = React.useState(searchParams.get("city") ?? "");
  const [district, setDistrict] = React.useState(searchParams.get("district") ?? "");
  const [propertyType, setPropertyType] = React.useState(searchParams.get("propertyType") ?? "");
  const [minPrice, setMinPrice] = React.useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = React.useState(searchParams.get("maxPrice") ?? "");
  const [minArea, setMinArea] = React.useState(searchParams.get("minArea") ?? "");
  const [maxArea, setMaxArea] = React.useState(searchParams.get("maxArea") ?? "");
  const [sellerOrgId, setSellerOrgId] = React.useState(searchParams.get("sellerOrgId") ?? "");
  const [bedrooms, setBedrooms] = React.useState(searchParams.get("bedrooms") ?? "");
  const [maxBuildingAge, setMaxBuildingAge] = React.useState(searchParams.get("maxBuildingAge") ?? "");

  // Data state
  const [listings, setListings] = React.useState<MarketplaceListingCardVM[]>([]);
  const [sellerOrgs, setSellerOrgs] = React.useState<{ id: string; name: string | null }[]>([]);
  const [loadingListings, setLoadingListings] = React.useState(true);
  const [inquiries, setInquiries] = React.useState<Inquiry[]>([]);
  const [loadingInquiries, setLoadingInquiries] = React.useState(false);

  // Withdraw dialog
  const [withdrawTarget, setWithdrawTarget] = React.useState<Inquiry | null>(null);
  const [withdrawing, setWithdrawing] = React.useState(false);
  const [withdrawError, setWithdrawError] = React.useState<string | null>(null);

  // Mobile filter panel
  const [showFilters, setShowFilters] = React.useState(false);

  // Push URL params
  function pushParams(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    setQ(""); setCity(""); setDistrict(""); setPropertyType("");
    setMinPrice(""); setMaxPrice(""); setMinArea(""); setMaxArea("");
    setSellerOrgId(""); setBedrooms(""); setMaxBuildingAge("");
    router.replace(pathname, { scroll: false });
  }

  const hasActiveFilters = [q, city, district, propertyType, minPrice, maxPrice, minArea, maxArea, sellerOrgId, bedrooms, maxBuildingAge].some(Boolean);

  // Load listings + seller org filters
  async function loadListings() {
    setLoadingListings(true);
    try {
      const [data, orgs] = await Promise.all([
        browseMarketplaceListings({
          q: q || undefined,
          city: city || undefined,
          district: district || undefined,
          propertyType: propertyType || undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          minArea: minArea ? Number(minArea) : undefined,
          maxArea: maxArea ? Number(maxArea) : undefined,
          sellerOrgId: sellerOrgId || undefined,
          bedrooms: bedrooms ? Number(bedrooms) : undefined,
          maxBuildingAge: maxBuildingAge ? Number(maxBuildingAge) : undefined,
        }),
        getMarketplaceSellerOrgFilters(),
      ]);
      setListings(data as MarketplaceListingCardVM[]);
      setSellerOrgs(orgs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingListings(false);
    }
  }

  async function loadInquiries() {
    setLoadingInquiries(true);
    try {
      const data = await listMyMarketplaceInquiries();
      setInquiries(data as unknown as Inquiry[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInquiries(false);
    }
  }

  // Reload listings whenever URL search params change
  React.useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Load inquiries when tab switches
  React.useEffect(() => {
    if (activeTab === "inquiries" && inquiries.length === 0) {
      loadInquiries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleWithdraw() {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await withdrawMarketplaceInquiry(withdrawTarget.id);
      setInquiries((prev) =>
        prev.map((i) => i.id === withdrawTarget.id ? { ...i, status: "WITHDRAWN" } : i)
      );
      setWithdrawTarget(null);
    } catch (err: unknown) {
      setWithdrawError(err instanceof Error ? err.message : (lang === "ar" ? "فشل سحب الاستفسار" : "Failed to withdraw inquiry"));
    } finally {
      setWithdrawing(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    pushParams({ q, city, district, propertyType, minPrice, maxPrice, minArea, maxArea, sellerOrgId, bedrooms, maxBuildingAge });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Page header */}
      <PageIntro
        title={lang === "ar" ? "السوق العقاري" : "Property Marketplace"}
        description={
          lang === "ar"
            ? "تصفّح العقارات المتاحة للبيع من المطورين والمؤسسات الأخرى"
            : "Browse properties listed for sale by developers and other organizations"
        }
        actions={
          can("marketplace:manage_own") ? (
            <Button asChild variant="secondary" className="gap-2">
              <Link href="/dashboard/marketplace/my-listings">
                <Tags className="h-4 w-4" aria-hidden="true" />
                {lang === "ar" ? "إعلاناتي" : "My Listings"}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("browse")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
            activeTab === "browse"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {lang === "ar" ? "تصفّح الإعلانات" : "Browse Listings"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inquiries")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
            activeTab === "inquiries"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {lang === "ar" ? "استفساراتي" : "My Inquiries"}
        </button>
      </div>

      {/* ── Browse tab ─────────────────────────────────────────────────── */}
      {activeTab === "browse" && (
        <div className="space-y-4">
          {/* Filter bar */}
          <form onSubmit={handleSearch} className="space-y-3">
            {/* Search + toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                <Input
                  aria-label={lang === "ar" ? "بحث في الإعلانات" : "Search listings"}
                  placeholder={lang === "ar" ? "ابحث بالعنوان أو المدينة..." : "Search by title or city…"}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="ps-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters((v) => !v)}
                aria-label={lang === "ar" ? "تصفية" : "Filters"}
                aria-expanded={showFilters}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="ms-1.5 hidden sm:inline">{lang === "ar" ? "تصفية" : "Filters"}</span>
                {hasActiveFilters && (
                  <span className="ms-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                    {[city, district, propertyType, minPrice, maxPrice, minArea, maxArea, sellerOrgId, bedrooms, maxBuildingAge].filter(Boolean).length}
                  </span>
                )}
              </Button>
              <Button type="submit" variant="primary">
                {lang === "ar" ? "بحث" : "Search"}
              </Button>
            </div>

            {/* Expanded filters */}
            {showFilters && (
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "المدينة" : "City"}
                    </label>
                    <Input
                      aria-label={lang === "ar" ? "المدينة" : "City"}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={lang === "ar" ? "الرياض..." : "Riyadh…"}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "الحي" : "District"}
                    </label>
                    <Input
                      aria-label={lang === "ar" ? "الحي" : "District"}
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder={lang === "ar" ? "العليا..." : "Al Olaya…"}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "نوع العقار" : "Property Type"}
                    </label>
                    <select
                      aria-label={lang === "ar" ? "نوع العقار" : "Property type"}
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">{lang === "ar" ? "الكل" : "All"}</option>
                      {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{lang === "ar" ? v.ar : v.en}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "البائع" : "Seller"}
                    </label>
                    <select
                      aria-label={lang === "ar" ? "البائع" : "Seller org"}
                      value={sellerOrgId}
                      onChange={(e) => setSellerOrgId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">{lang === "ar" ? "الكل" : "All"}</option>
                      {sellerOrgs.map((o) => (
                        <option key={o.id} value={o.id}>{o.name ?? o.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "أدنى سعر (ر.س)" : "Min Price (SAR)"}
                    </label>
                    <Input
                      aria-label={lang === "ar" ? "أدنى سعر" : "Min price"}
                      type="number"
                      min={0}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "أقصى سعر (ر.س)" : "Max Price (SAR)"}
                    </label>
                    <Input
                      aria-label={lang === "ar" ? "أقصى سعر" : "Max price"}
                      type="number"
                      min={0}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="—"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "أدنى مساحة (م²)" : "Min Area (m²)"}
                    </label>
                    <Input
                      aria-label={lang === "ar" ? "أدنى مساحة" : "Min area"}
                      type="number"
                      min={0}
                      value={minArea}
                      onChange={(e) => setMinArea(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "أقصى مساحة (م²)" : "Max Area (m²)"}
                    </label>
                    <Input
                      aria-label={lang === "ar" ? "أقصى مساحة" : "Max area"}
                      type="number"
                      min={0}
                      value={maxArea}
                      onChange={(e) => setMaxArea(e.target.value)}
                      placeholder="—"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "أدنى عدد غرف" : "Min Bedrooms"}
                    </label>
                    <Input
                      aria-label={lang === "ar" ? "أدنى عدد غرف" : "Min bedrooms"}
                      type="number"
                      min={0}
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "ar" ? "أقصى عمر المبنى (سنة)" : "Max Building Age (yrs)"}
                    </label>
                    <Input
                      aria-label={lang === "ar" ? "أقصى عمر المبنى" : "Max building age"}
                      type="number"
                      min={0}
                      value={maxBuildingAge}
                      onChange={(e) => setMaxBuildingAge(e.target.value)}
                      placeholder="—"
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  {hasActiveFilters && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                      {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                    </Button>
                  )}
                  <Button type="submit" variant="primary" size="sm">
                    {lang === "ar" ? "تطبيق" : "Apply"}
                  </Button>
                </div>
              </Card>
            )}
          </form>

          {/* Results */}
          {loadingListings ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <EmptyState
              variant="filtered"
              icon={<Store className="h-12 w-12" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد إعلانات مطابقة" : "No listings found"}
              description={
                lang === "ar"
                  ? "جرّب تعديل معايير البحث أو مسح الفلاتر لعرض جميع الإعلانات"
                  : "Try adjusting your search criteria or clear filters to see all listings"
              }
              action={
                hasActiveFilters ? (
                  <Button variant="primary" onClick={clearFilters}>
                    <X className="h-4 w-4 me-1.5" aria-hidden="true" />
                    {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {listings.map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/dashboard/marketplace/${listing.id}`}
                    className="block"
                  >
                    <Card className="p-4 hover:border-primary/50 transition-colors min-h-[44px]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {listing.title ?? listing.listingNumber}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {listing.city && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="h-3 w-3" aria-hidden="true" />
                                {listing.city}{listing.district ? `، ${listing.district}` : ""}
                              </span>
                            )}
                            {listing.propertyType && (
                              <span>
                                {lang === "ar"
                                  ? (PROPERTY_TYPE_LABELS[listing.propertyType]?.ar ?? listing.propertyType)
                                  : (PROPERTY_TYPE_LABELS[listing.propertyType]?.en ?? listing.propertyType)}
                              </span>
                            )}
                            {listing.bedrooms != null && (
                              <span className="inline-flex items-center gap-0.5">
                                <BedDouble className="h-3 w-3" aria-hidden="true" />
                                {listing.bedrooms}
                              </span>
                            )}
                          </div>
                          {listing.sellerOrgName && (
                            <p className="text-xs text-muted-foreground truncate">
                              <Building2 className="inline h-3 w-3 me-0.5" aria-hidden="true" />
                              {listing.sellerOrgName}
                            </p>
                          )}
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-sm font-bold text-primary">
                            {formatSARLocal(listing.price, lang)}
                          </p>
                          {listing.area != null && (
                            <p className="text-xs text-muted-foreground">
                              {listing.area} {lang === "ar" ? "م²" : "m²"}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Card className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{lang === "ar" ? "رقم الإعلان" : "Listing #"}</TableHead>
                        <TableHead>{lang === "ar" ? "العنوان" : "Title"}</TableHead>
                        <TableHead>{lang === "ar" ? "الموقع" : "Location"}</TableHead>
                        <TableHead>{lang === "ar" ? "النوع" : "Type"}</TableHead>
                        <TableHead>{lang === "ar" ? "الغرف" : "Beds"}</TableHead>
                        <TableHead>{lang === "ar" ? "المساحة" : "Area"}</TableHead>
                        <TableHead>{lang === "ar" ? "السعر" : "Price"}</TableHead>
                        <TableHead>{lang === "ar" ? "البائع" : "Seller"}</TableHead>
                        <TableHead>{lang === "ar" ? "المشاهدات" : "Views"}</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listings.map((listing) => (
                        <TableRow key={listing.id}>
                          <TableCell>
                            <span className="font-mono text-xs text-muted-foreground">
                              {listing.listingNumber}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-foreground line-clamp-1">
                              {listing.title ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground">
                              {[listing.city, listing.district].filter(Boolean).join("، ")}
                            </span>
                          </TableCell>
                          <TableCell>
                            {listing.propertyType ? (
                              <Badge variant="outline" className="text-xs">
                                {lang === "ar"
                                  ? (PROPERTY_TYPE_LABELS[listing.propertyType]?.ar ?? listing.propertyType)
                                  : (PROPERTY_TYPE_LABELS[listing.propertyType]?.en ?? listing.propertyType)}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground">
                              {listing.bedrooms ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground">
                              {listing.area != null ? `${listing.area} ${lang === "ar" ? "م²" : "m²"}` : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-primary">
                              {formatSARLocal(listing.price, lang)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {listing.sellerOrgName ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Eye className="h-3 w-3" aria-hidden="true" />
                              {listing.viewCount}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/dashboard/marketplace/${listing.id}`}>
                                {lang === "ar" ? "عرض" : "View"}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Inquiries tab ────────────────────────────────────────────────── */}
      {activeTab === "inquiries" && (
        <div className="space-y-4">
          {loadingInquiries ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : inquiries.length === 0 ? (
            <EmptyState
              variant="first-time"
              icon={<Inbox className="h-12 w-12" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد استفسارات بعد" : "No inquiries yet"}
              description={
                lang === "ar"
                  ? "تصفّح الإعلانات وأبدِ اهتمامك بالعقارات التي تستوفي متطلباتك"
                  : "Browse listings and express interest in properties that meet your requirements"
              }
              action={
                <Button variant="primary" onClick={() => setActiveTab("browse")}>
                  {lang === "ar" ? "تصفّح الإعلانات" : "Browse Listings"}
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {inquiries.map((inq) => (
                  <Card key={inq.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <Link
                          href={`/dashboard/marketplace/${inq.listing.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary truncate block"
                        >
                          {inq.listing.title ?? inq.listing.listingNumber}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              INQUIRY_STATUS_STYLES[inq.status] ?? "bg-muted text-muted-foreground"
                            )}
                          >
                            {lang === "ar"
                              ? (INQUIRY_STATUS_LABELS[inq.status]?.ar ?? inq.status)
                              : (INQUIRY_STATUS_LABELS[inq.status]?.en ?? inq.status)}
                          </span>
                          {inq.listing.city && (
                            <span className="text-xs text-muted-foreground">{inq.listing.city}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatSARLocal(inq.listing.price, lang)}
                        </p>
                      </div>
                      {inq.status === "OPEN" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="shrink-0 min-h-[44px]"
                          onClick={() => { setWithdrawTarget(inq); setWithdrawError(null); }}
                        >
                          {lang === "ar" ? "سحب" : "Withdraw"}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Card className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{lang === "ar" ? "الإعلان" : "Listing"}</TableHead>
                        <TableHead>{lang === "ar" ? "المدينة" : "City"}</TableHead>
                        <TableHead>{lang === "ar" ? "السعر" : "Price"}</TableHead>
                        <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                        <TableHead>{lang === "ar" ? "التحويل" : "Transfer"}</TableHead>
                        <TableHead>{lang === "ar" ? "التاريخ" : "Date"}</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inquiries.map((inq) => (
                        <TableRow key={inq.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/marketplace/${inq.listing.id}`}
                              className="text-sm font-medium text-foreground hover:text-primary"
                            >
                              {inq.listing.title ?? inq.listing.listingNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground">{inq.listing.city ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-primary">
                              {formatSARLocal(inq.listing.price, lang)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                INQUIRY_STATUS_STYLES[inq.status] ?? "bg-muted text-muted-foreground"
                              )}
                            >
                              {lang === "ar"
                                ? (INQUIRY_STATUS_LABELS[inq.status]?.ar ?? inq.status)
                                : (INQUIRY_STATUS_LABELS[inq.status]?.en ?? inq.status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {inq.transfer ? (
                              <span className="text-xs text-muted-foreground">{inq.transfer.status}</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {new Date(inq.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB")}
                            </span>
                          </TableCell>
                          <TableCell>
                            {inq.status === "OPEN" && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => { setWithdrawTarget(inq); setWithdrawError(null); }}
                              >
                                {lang === "ar" ? "سحب" : "Withdraw"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* Withdraw confirm dialog */}
      <ResponsiveDialog
        open={!!withdrawTarget}
        onOpenChange={(open) => { if (!open) setWithdrawTarget(null); }}
        title={lang === "ar" ? "سحب الاستفسار" : "Withdraw Inquiry"}
        description={
          lang === "ar"
            ? `هل أنت متأكد من سحب استفسارك على "${withdrawTarget?.listing.title ?? withdrawTarget?.listing.listingNumber}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to withdraw your inquiry on "${withdrawTarget?.listing.title ?? withdrawTarget?.listing.listingNumber}"? This cannot be undone.`
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setWithdrawTarget(null)}
              disabled={withdrawing}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleWithdraw}
              disabled={withdrawing}
            >
              {withdrawing ? (
                <Loader2 className="h-4 w-4 animate-spin me-1.5" aria-hidden="true" />
              ) : (
                <Handshake className="h-4 w-4 me-1.5" aria-hidden="true" />
              )}
              {lang === "ar" ? "تأكيد السحب" : "Confirm Withdraw"}
            </Button>
          </div>
        }
      >
        {withdrawError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {withdrawError}
          </div>
        )}
      </ResponsiveDialog>
    </div>
  );
}
