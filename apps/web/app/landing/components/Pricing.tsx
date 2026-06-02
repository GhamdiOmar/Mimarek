"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Sparkles,
  Crown,
  Check,
  X,
} from "lucide-react";
import { Button } from "@repo/ui";
import { t as translations } from "../translations";
import type { LucideIcon } from "lucide-react";

type Plan = {
  slug: string;
  icon: LucideIcon;
  name: string;
  desc: string;
  monthlyPrice: number;
  annualPrice: number;
  limits: { users: string; units: string };
  features: { key: string; label: string; included: boolean }[];
  supportLevel: string;
  highlighted: boolean;
  cta: string;
  ctaHref: string;
};

export default function Pricing({ lang }: { lang: "ar" | "en" }) {
  const t = translations[lang];
  const [annual, setAnnual] = useState(true);

  const plans: Plan[] = [
    {
      slug: "starter",
      icon: Building2,
      name: t.starter,
      desc: t.starterDesc,
      monthlyPrice: 0,
      annualPrice: 0,
      limits: { users: "5", units: "50" },
      features: [
        { key: "cmms", label: t.cmmsAccess, included: false },
        { key: "reports", label: t.reportsExport, included: false },
        { key: "pii", label: t.piiEncryption, included: false },
        { key: "audit", label: t.auditAccess, included: false },
        { key: "api", label: t.apiAccess, included: false },
        { key: "branding", label: t.customBranding, included: false },
      ],
      supportLevel: t.standardSupport,
      highlighted: false,
      cta: t.getStarted,
      ctaHref: "/auth/register",
    },
    {
      slug: "professional",
      icon: Sparkles,
      name: t.professional,
      desc: t.professionalDesc,
      monthlyPrice: 499,
      annualPrice: 4790,
      limits: { users: "25", units: "500" },
      features: [
        { key: "cmms", label: t.cmmsAccess, included: true },
        { key: "reports", label: t.reportsExport, included: true },
        { key: "pii", label: t.piiEncryption, included: true },
        { key: "audit", label: t.auditAccess, included: true },
        { key: "api", label: t.apiAccess, included: false },
        { key: "branding", label: t.customBranding, included: false },
      ],
      supportLevel: t.businessSupport,
      highlighted: true,
      cta: t.startTrial,
      ctaHref: "/auth/register",
    },
    {
      slug: "enterprise",
      icon: Crown,
      name: t.enterprise,
      desc: t.enterpriseDesc,
      monthlyPrice: 1499,
      annualPrice: 14390,
      limits: {
        users: t.unlimited,
        units: t.unlimited,
      },
      features: [
        { key: "cmms", label: t.cmmsAccess, included: true },
        { key: "reports", label: t.reportsExport, included: true },
        { key: "pii", label: t.piiEncryption, included: true },
        { key: "audit", label: t.auditAccess, included: true },
        { key: "api", label: t.apiAccess, included: true },
        { key: "branding", label: t.customBranding, included: true },
      ],
      supportLevel: t.premiumSupport,
      highlighted: false,
      cta: t.startTrial,
      ctaHref: "/auth/register",
    },
  ];

  function formatPrice(plan: Plan) {
    const price = annual ? plan.annualPrice : plan.monthlyPrice;
    if (price === 0) return t.free;
    return price.toLocaleString();
  }

  function priceSuffix(plan: Plan) {
    if (plan.monthlyPrice === 0) return "";
    return annual ? t.perYear : t.perMonth;
  }

  return (
    <section id="pricing" className="bg-muted/30 py-20 dark:bg-muted/10 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-primary dark:text-white sm:text-4xl">
            {t.pricingTitle}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t.pricingSubtitle}
          </p>
        </div>

        {/* Toggle */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <span
            className={`text-sm font-medium ${!annual ? "text-primary dark:text-white" : "text-muted-foreground"}`}
          >
            {t.monthly}
          </span>
          <Button
            asChild
            style={{ display: "inline-flex" }}
          >
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                annual ? "bg-primary" : "bg-muted-foreground/30"
              }`}
              aria-label={t.pricingToggleAriaLabel}
              role="switch"
              aria-checked={annual}
              type="button"
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
                  annual
                    ? lang === "ar"
                      ? "-translate-x-[1.25rem]"
                      : "translate-x-[1.25rem]"
                    : lang === "ar"
                      ? "-translate-x-0.5"
                      : "translate-x-0.5"
                }`}
              />
            </button>
          </Button>
          <span
            className={`text-sm font-medium ${annual ? "text-primary dark:text-white" : "text-muted-foreground"}`}
          >
            {t.annual}
          </span>
          {annual && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary dark:text-white">
              {t.annualSave}
            </span>
          )}
        </div>

        {/* Plan cards */}
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.slug}
                className={`relative overflow-hidden rounded-2xl border p-6 transition-colors ${
                  plan.highlighted
                    ? "border-primary bg-card shadow-md dark:bg-card"
                    : "border-border/50 bg-card/80 shadow-sm backdrop-blur-sm dark:bg-card/50"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute top-3 end-3 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary dark:text-white">
                    {t.mostPopular}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-9 items-center justify-center rounded-lg ${
                      plan.highlighted
                        ? "bg-primary/10"
                        : "bg-muted dark:bg-muted/50"
                    }`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] ${
                        plan.highlighted
                          ? "text-primary"
                          : "text-primary dark:text-white"
                      }`}
                    />
                  </div>
                  <h3 className="text-lg font-bold text-primary dark:text-white">
                    {plan.name}
                  </h3>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.desc}
                </p>

                {/* Price */}
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-dm-sans text-4xl font-bold text-primary dark:text-white">
                    {formatPrice(plan)}
                  </span>
                  {priceSuffix(plan) && (
                    <span className="text-sm text-muted-foreground">
                      {priceSuffix(plan)}
                    </span>
                  )}
                </div>

                {/* CTA */}
                <Button
                  asChild
                  className={`mt-5 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? "bg-primary text-white hover:bg-primary/85"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-primary dark:hover:bg-gray-100"
                  }`}
                  style={{ display: "inline-flex", justifyContent: "center" }}
                >
                  <Link href={plan.ctaHref}>
                    {plan.cta}
                  </Link>
                </Button>

                {/* Limits */}
                <div className="mt-5 space-y-1.5 border-t border-border pt-5">
                  <p className="text-sm text-foreground/80">
                    <span className="font-semibold">{plan.limits.users}</span>{" "}
                    {t.users}
                  </p>
                  <p className="text-sm text-foreground/80">
                    <span className="font-semibold">{plan.limits.units}</span>{" "}
                    {t.units}
                  </p>
                </div>

                {/* Features */}
                <div className="mt-3 space-y-1.5">
                  {plan.features.map(({ key, label, included }) => (
                    <div key={key} className="flex items-center gap-2">
                      {included ? (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-primary"
                          strokeWidth={2.5}
                        />
                      ) : (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
                          strokeWidth={2}
                        />
                      )}
                      <span
                        className={`text-sm ${
                          included
                            ? "text-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Support level */}
                <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                  {plan.supportLevel}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
