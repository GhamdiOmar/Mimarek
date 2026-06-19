"use client";

import { ShieldCheck, Building2, Receipt } from "lucide-react";
import { t as translations } from "../translations";

export default function LogoBar({ lang }: { lang: "ar" | "en" }) {
  const t = translations[lang];

  const badges = [
    { icon: ShieldCheck, label: t.vision2030Aligned },
    { icon: Building2, label: t.baladyCompliant },
    { icon: Receipt, label: t.zatcaInvoicing },
  ];

  return (
    <section id="compliance" className="border-y border-border bg-muted/30 py-8 dark:bg-muted/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground">
          {t.complianceStrip}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-8 sm:gap-14">
          {badges.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
