"use client";

import * as React from "react";
import { ArrowLeft, Search as SearchIcon, Users, Building2, FileText, X } from "lucide-react";
import Link from "next/link";
import { BottomSheet, DirectionalIcon } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "../LanguageProvider";
import { globalSearch } from "../../app/actions/search";

interface MobileSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GroupKey = "customers" | "units" | "contracts";

const groupMeta: Record<GroupKey, { label: { ar: string; en: string }; prefix: string; icon: React.ElementType }> = {
  customers: { label: { ar: "العملاء", en: "Customers" }, prefix: "/dashboard/crm", icon: Users },
  units: { label: { ar: "الوحدات", en: "Units" }, prefix: "/dashboard/units", icon: Building2 },
  contracts: { label: { ar: "العقود", en: "Contracts" }, prefix: "/dashboard/contracts", icon: FileText },
};

export function MobileSearchSheet({ open, onOpenChange }: MobileSearchSheetProps) {
  const { lang } = useLanguage();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Record<GroupKey, Array<{ id: string; name: string }>> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  function handleInput(value: string) {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!value.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const r = await globalSearch(value.trim());
        setResults(r as Record<GroupKey, Array<{ id: string; name: string }>>);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  const hasAnyResults = results && (Object.keys(results) as GroupKey[]).some((k) => results[k]?.length > 0);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      className="!max-h-[100vh] !h-[100vh] !rounded-none"
    >
      <div className="-mx-4 -mb-4 flex h-full flex-col">
        {/* AppBar */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2">
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground rtl:scale-x-[-1]"
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
          >
            <DirectionalIcon icon={ArrowLeft} className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <SearchIcon className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              placeholder={lang === "ar" ? "بحث عن عميل أو وحدة أو عقد..." : "Search customers, units, contracts..."}
              className="w-full rounded-md bg-muted/40 py-2 ps-9 pe-9 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button
                onClick={() => handleInput("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60"
                aria-label={lang === "ar" ? "مسح" : "Clear"}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!query && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <SearchIcon className="h-7 w-7 text-primary" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">
                {lang === "ar" ? "ابدأ بالكتابة للبحث" : "Start typing to search"}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed px-6">
                {lang === "ar"
                  ? "ابحث عن العملاء والوحدات والعقود"
                  : "Find customers, units, and contracts"}
              </p>
            </div>
          )}

          {query && loading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}

          {query && !loading && !hasAnyResults && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-semibold text-foreground">
                {lang === "ar" ? "لا توجد نتائج" : "No results"}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground px-6">
                {lang === "ar"
                  ? `لم نعثر على نتائج لـ "${query}"`
                  : `No matches for "${query}"`}
              </p>
            </div>
          )}

          {query && !loading && hasAnyResults && results && (
            <div className="space-y-5">
              {(Object.keys(groupMeta) as GroupKey[]).map((key) => {
                const items = results[key] ?? [];
                if (items.length === 0) return null;
                const meta = groupMeta[key];
                const Icon = meta.icon;
                return (
                  <div key={key}>
                    <div className="px-1 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {meta.label[lang]}
                    </div>
                    <div className="space-y-1.5">
                      {items.map((item) => (
                        <Link
                          key={item.id}
                          href={`${meta.prefix}/${item.id}`}
                          onClick={() => onOpenChange(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors",
                            "hover:bg-muted/30 active:bg-muted/50"
                          )}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
