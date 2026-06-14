"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Search as SearchIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { BottomSheet, IconButton } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "../LanguageProvider";
import { useFederatedSearch } from "../../hooks/useFederatedSearch";
import { trackEvent, AnalyticsEvent } from "../../lib/analytics";
import { SEARCH_ENTITY_META, SEARCH_ENTITY_ORDER } from "../../lib/search-entity-meta";

interface MobileSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSearchSheet({ open, onOpenChange }: MobileSearchSheetProps) {
  const { lang } = useLanguage();
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { groups, loading, showSpinner, error, isSearching } = useFederatedSearch(query, lang);
  const resultCount = React.useMemo(
    () => groups.reduce((sum, g) => sum + g.hits.length, 0),
    [groups],
  );
  const hasAnyResults = groups.length > 0;

  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    } else {
      setQuery("");
    }
  }, [open]);

  // Report only the result count to analytics — NEVER the query (it can be PII).
  const prevLoadingRef = React.useRef(false);
  React.useEffect(() => {
    // Fire once per settled search (loading true→false). Count only.
    if (prevLoadingRef.current && !loading && isSearching) {
      trackEvent(AnalyticsEvent.SearchPerformed, { result_count: resultCount });
    }
    prevLoadingRef.current = loading;
  }, [loading, isSearching, resultCount]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={lang === "ar" ? "البحث" : "Search"}
      srOnlyTitle
      className="!max-h-[100vh] !h-[100vh] !rounded-none"
    >
      <div className="-mx-4 -mb-4 flex h-full flex-col">
        {/* AppBar */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2">
          <IconButton
            icon={ArrowLeft}
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
            onClick={() => onOpenChange(false)}
            variant="ghost"
            directional
          />
          <div className="relative flex-1">
            <SearchIcon className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === "ar" ? "ابحث عن عميل أو وحدة أو عقد..." : "Search customers, units, contracts..."}
              aria-label={lang === "ar" ? "بحث" : "Search"}
              className="w-full rounded-md bg-muted/40 py-2 ps-9 pe-9 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <IconButton
                icon={X}
                aria-label={lang === "ar" ? "مسح" : "Clear"}
                onClick={() => setQuery("")}
                variant="ghost"
                className="absolute end-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full md:h-7 md:w-7"
              />
            )}
          </div>
        </div>

        {/* Result-count announcement for assistive tech. */}
        <span className="sr-only" role="status" aria-live="polite">
          {isSearching ? (lang === "ar" ? `${resultCount} نتيجة` : `${resultCount} results`) : ""}
        </span>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!isSearching && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <SearchIcon className="h-7 w-7 text-primary" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">
                {lang === "ar" ? "ابدأ بالكتابة للبحث" : "Start typing to search"}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed px-6">
                {lang === "ar"
                  ? "ابحث عن العملاء والوحدات والعقود والمزيد"
                  : "Find customers, units, contracts and more"}
              </p>
            </div>
          )}

          {isSearching && (loading || showSpinner) && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}

          {isSearching && !loading && error && (
            <div role="alert" className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-semibold text-destructive">
                {lang === "ar" ? "تعذّر إجراء البحث" : "Search failed"}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground px-6">
                {lang === "ar" ? "حاول مرة أخرى." : "Please try again."}
              </p>
            </div>
          )}

          {isSearching && !loading && !error && !hasAnyResults && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-semibold text-foreground">
                {lang === "ar" ? "لا توجد نتائج" : "No results"}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground px-6">
                {lang === "ar"
                  ? `لم نعثر على نتائج لـ "${query.trim()}"`
                  : `No matches for "${query.trim()}"`}
              </p>
            </div>
          )}

          {isSearching && !loading && !error && hasAnyResults && (
            <div className="space-y-5">
              {SEARCH_ENTITY_ORDER.map((type) => {
                const group = groups.find((g) => g.type === type);
                if (!group || group.hits.length === 0) return null;
                const meta = SEARCH_ENTITY_META[type];
                const Icon = meta.icon;
                return (
                  <div key={type}>
                    <div className="px-1 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {meta.label[lang]}
                    </div>
                    <div className="space-y-1.5">
                      {group.hits.map((hit) => (
                        <Link
                          key={`${hit.type}:${hit.id}`}
                          href={hit.href}
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
                            <p className="text-sm font-medium text-foreground truncate">{hit.title}</p>
                            {hit.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{hit.subtitle}</p>
                            )}
                          </div>
                          {hit.maskedPii && (
                            <span dir="ltr" className="number-ltr shrink-0 text-xs text-muted-foreground tabular-nums">
                              {hit.maskedPii}
                            </span>
                          )}
                        </Link>
                      ))}
                      {group.hasMore && (
                        <Link
                          href={SEARCH_ENTITY_META[type].listHref(query)}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium text-primary hover:bg-muted/30 active:bg-muted/50 transition-colors"
                        >
                          <ArrowRight className="h-3.5 w-3.5 icon-directional" />
                          <span>{lang === "ar" ? "عرض الكل" : "See all"}</span>
                        </Link>
                      )}
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
