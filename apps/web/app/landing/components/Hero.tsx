"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Receipt,
  HardHat,
} from "lucide-react";
import { Button } from "@repo/ui";
import { t as translations } from "../translations";

export default function Hero({ lang }: { lang: "ar" | "en" }) {
  const t = translations[lang];

  const badges = [
    { icon: ShieldCheck, label: t.vision2030Aligned },
    { icon: Building2, label: t.baladyCompliant },
    { icon: Receipt, label: t.zatcaInvoicing },
    { icon: HardHat, label: t.wafiReady },
  ];

  return (
    <section className="relative overflow-hidden mesh-bg">
      {/* Background pattern — architectural grid */}
      <div className="absolute inset-0 opacity-[0.05]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="arch-hero"
              x="0"
              y="0"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0 0L40 40L80 0M0 80L40 40L80 80"
                stroke="hsl(270 55% 62%)"
                strokeWidth="0.5"
                fill="none"
              />
              <circle cx="40" cy="40" r="1.5" fill="hsl(270 55% 62%)" opacity="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#arch-hero)" />
        </svg>
      </div>

      {/* Single subtle gradient blob */}
      <div className="absolute top-1/4 start-1/4 w-96 h-96 rounded-full bg-primary/8 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-28 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1
            className="font-dm-sans text-5xl font-extrabold leading-[1.1] text-white sm:text-6xl lg:text-7xl xl:text-8xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            {t.heroTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">
            {t.heroSubtitle}
          </p>

          {/* CTAs — one primary button + text link */}
          <div className="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Button
              asChild
              className="rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5"
              style={{ display: "inline-flex" }}
            >
              <Link href="/auth/register">
                {t.startFreeTrial}
              </Link>
            </Button>
            <a
              href="#features"
              className="text-sm font-medium text-white/60 underline underline-offset-4 decoration-white/20 transition-colors hover:text-white hover:decoration-white/40"
            >
              {t.watchDemo}
            </a>
          </div>

          {/* Trust badges — simple inline row */}
          <div className="mt-14 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-full bg-white/[0.04] px-6 py-3">
            {badges.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-white/70 sm:text-sm">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Dashboard preview — clean frame, no floating cards */}
          <div className="mt-16">
            <div className="overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/screenshots/dashboard.png"
                alt="Mimaric Dashboard"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
