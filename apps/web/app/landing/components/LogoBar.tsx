"use client";

import { Building2, Home, CircleDollarSign } from "lucide-react";
import { t as translations } from "../translations";

export default function LogoBar({ lang }: { lang: "ar" | "en" }) {
  const t = translations[lang];

  const stats = [
    { value: "500+", label: t.propertiesManaged, icon: Building2 },
    { value: "10,000+", label: t.unitsTracked, icon: Home },
    { value: "50M+", label: t.sarProcessed, icon: CircleDollarSign },
  ];

  const placeholderLogos = [
    "Al-Ofoq Real Estate",
    "Modern Construction",
    "Riyadh Oasis",
    "Gulf Developers",
    "Saudi Homes",
  ];

  return (
    <section id="social-proof" className="border-y border-border bg-muted/30 py-10 dark:bg-muted/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground">
          {t.trustedBy}
        </p>

        {/* Logo placeholder row */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {placeholderLogos.map((name) => (
            <div
              key={name}
              className="flex h-9 items-center rounded border border-border/40 bg-card/50 px-4 text-xs font-medium text-muted-foreground"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {stats.map(({ value, label, icon: Icon }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold text-primary dark:text-white sm:text-3xl">
                  {value}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
