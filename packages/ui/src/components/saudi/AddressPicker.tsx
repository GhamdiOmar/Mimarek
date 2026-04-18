"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";
import { cn } from "../../lib/utils";
import regionsData from "../../data/saudi-regions.json";

export interface SaudiCity {
  code: string;
  nameEn: string;
  nameAr: string;
}

export interface SaudiRegion {
  code: string;
  nameEn: string;
  nameAr: string;
  cities: SaudiCity[];
}

export interface SaudiAddress {
  regionCode?: string;
  cityCode?: string;
  /** District free-text until Balady list ships. */
  district?: string;
}

export interface AddressPickerProps {
  value?: SaudiAddress;
  onChange?: (next: SaudiAddress) => void;
  locale?: "ar" | "en";
  className?: string;
  disabled?: boolean;
  /** Render an additional district free-text input below the cascade. */
  showDistrict?: boolean;
}

const REGIONS: SaudiRegion[] = (regionsData as { regions: SaudiRegion[] })
  .regions;

export function AddressPicker({
  value,
  onChange,
  locale,
  className,
  disabled,
  showDistrict = true,
}: AddressPickerProps) {
  const effectiveLocale: "ar" | "en" =
    locale ??
    (typeof document !== "undefined" && document.documentElement.lang === "ar"
      ? "ar"
      : "en");

  const region = React.useMemo(
    () => REGIONS.find((r) => r.code === value?.regionCode),
    [value?.regionCode],
  );

  const label = (r: { nameEn: string; nameAr: string }) =>
    effectiveLocale === "ar" ? r.nameAr : r.nameEn;

  const t = effectiveLocale === "ar"
    ? { region: "المنطقة", city: "المدينة", district: "الحي", pickRegion: "اختر المنطقة", pickCity: "اختر المدينة", districtPh: "اسم الحي" }
    : { region: "Region", city: "City", district: "District", pickRegion: "Select region", pickCity: "Select city", districtPh: "Neighborhood name" };

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t.region}
        </label>
        <Select
          value={value?.regionCode ?? ""}
          onValueChange={(v) =>
            onChange?.({ regionCode: v, cityCode: undefined, district: value?.district })
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.pickRegion} />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {label(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t.city}
        </label>
        <Select
          value={value?.cityCode ?? ""}
          onValueChange={(v) =>
            onChange?.({
              regionCode: value?.regionCode,
              cityCode: v,
              district: value?.district,
            })
          }
          disabled={disabled || !region}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.pickCity} />
          </SelectTrigger>
          <SelectContent>
            {region?.cities.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {label(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showDistrict && (
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t.district}
          </label>
          <input
            type="text"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={t.districtPh}
            value={value?.district ?? ""}
            onChange={(e) =>
              onChange?.({
                regionCode: value?.regionCode,
                cityCode: value?.cityCode,
                district: e.target.value,
              })
            }
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

export { REGIONS as SAUDI_REGIONS };
