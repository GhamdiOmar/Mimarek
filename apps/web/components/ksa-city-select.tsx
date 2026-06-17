"use client";

import * as React from "react";
import { useLanguage } from "./LanguageProvider";
import { KSA_CITIES } from "../lib/ksa-cities";

interface KsaCitySelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Searchable KSA city dropdown with bilingual labels.
 * Groups cities by region and supports type-ahead filtering.
 */
export function KsaCitySelect({ value, onChange, placeholder, className }: KsaCitySelectProps) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const defaultPlaceholder = t("اختر المدينة...", "Select city...");

  const filtered = React.useMemo(() => {
    if (!search.trim()) return KSA_CITIES;
    const q = search.toLowerCase();
    return KSA_CITIES.filter(
      (c) =>
        c.labelAr.includes(search) ||
        c.labelEn.toLowerCase().includes(q) ||
        c.value.includes(q)
    );
  }, [search]);

  const selectedLabel = React.useMemo(() => {
    const city = KSA_CITIES.find((c) => c.value === value);
    if (!city) return "";
    return lang === "ar" ? city.labelAr : city.labelEn;
  }, [value, lang]);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative ${className ?? ""}`}>
      <input
        ref={inputRef}
        type="text"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder={placeholder ?? defaultPlaceholder}
        value={open ? search : selectedLabel}
        onFocus={() => {
          setOpen(true);
          setSearch("");
        }}
        onChange={(e) => setSearch(e.target.value)}
      />

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {t("لا توجد نتائج", "No results")}
            </div>
          ) : (
            filtered.map((city) => (
              // eslint-disable-next-line -- raw <button> intentional: these are listbox-option elements
              // inside a custom combobox dropdown. Button adds w-fit + whitespace-nowrap + fixed
              // height (h-8/h-10) which breaks the w-full dropdown layout and option row density.
              // Migrating to Button here would require overriding the variant entirely, defeating
              // governance. Revisit if a Combobox/ListboxOption primitive ships in @repo/ui.
              <button
                key={city.value}
                type="button"
                className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-amber-500/50 transition-colors ${
                  value === city.value ? "bg-amber-500/30 font-medium" : ""
                }`}
                onClick={() => {
                  onChange(city.value);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span>{lang === "ar" ? city.labelAr : city.labelEn}</span>
                <span className="text-xs text-muted-foreground">
                  {lang === "ar" ? city.labelEn : city.labelAr}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
