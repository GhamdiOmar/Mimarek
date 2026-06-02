"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { t as translations } from "../translations";

export default function Footer({
  lang,
  onToggleLang,
  toggleLangHref,
}: {
  lang: "ar" | "en";
  onToggleLang?: () => void;
  toggleLangHref?: string;
}) {
  const t = translations[lang];

  const columns = [
    {
      title: t.product,
      links: [
        { label: t.features, href: "#features" },
        { label: t.pricing, href: "#pricing" },
        { label: t.vision2030, href: "#vision2030" },
      ],
    },
    {
      title: t.company,
      links: [
        { label: t.aboutUs, href: "#" },
        { label: t.careers, href: "#" },
        { label: t.blog, href: "#" },
      ],
    },
    {
      title: t.legal,
      links: [
        { label: t.termsOfService, href: "#" },
        { label: t.privacyPolicy, href: "#" },
      ],
    },
    {
      title: t.support,
      links: [
        { label: t.helpCenter, href: "#" },
        { label: t.documentation, href: "#" },
        { label: t.status, href: "#" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-6 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/brand/Mimaric_Official_Logo_transparent.png"
              alt="Mimaric"
              className="h-8 w-auto dark:brightness-0 dark:invert"
            />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t.tagline}
            </p>

            {/* Language toggle */}
            {toggleLangHref ? (
              <Link
                href={toggleLangHref}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Globe className="h-3.5 w-3.5" />
                {lang === "ar" ? "English" : "العربية"}
              </Link>
            ) : (
              <button
                onClick={onToggleLang}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                style={{ display: "inline-flex" }}
              >
                <Globe className="h-3.5 w-3.5" />
                {lang === "ar" ? "English" : "العربية"}
              </button>
            )}

            {/* Made in Saudi badge */}
            <p className="mt-3 text-xs text-muted-foreground">
              {t.madeInSaudi}
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-primary dark:text-white">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary dark:hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-border pt-6">
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Mimaric. {t.allRightsReserved}
          </p>
        </div>
      </div>
    </footer>
  );
}
