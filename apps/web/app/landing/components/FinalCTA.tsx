"use client";

import Link from "next/link";
import { t as translations } from "../translations";

export default function FinalCTA({ lang }: { lang: "ar" | "en" }) {
  const t = translations[lang];

  return (
    <section id="cta" className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary py-20 lg:py-24">
      {/* Single subtle decorative element */}
      <div className="absolute -top-24 -end-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
          {t.finalCtaTitle}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
          {t.finalCtaSubtitle}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/register"
            className="rounded-xl bg-white px-8 py-3.5 text-base font-bold text-primary-deep shadow-lg transition-colors hover:bg-gray-100"
            style={{ display: "inline-flex" }}
          >
            {t.startFreeTrial}
          </Link>
          <Link
            href="#pricing"
            className="rounded-xl border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
            style={{ display: "inline-flex" }}
          >
            {t.contactSales}
          </Link>
        </div>
      </div>
    </section>
  );
}
