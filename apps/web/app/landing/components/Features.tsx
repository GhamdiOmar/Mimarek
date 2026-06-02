"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Store,
  Home,
  Wrench,
  CircleDollarSign,
  Check,
  type LucideIcon,
} from "lucide-react";
import { t as translations } from "../translations";

type FeatureTab = {
  id: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  features: string[];
};

export default function Features({ lang }: { lang: "ar" | "en" }) {
  const t = translations[lang];

  const tabs: FeatureTab[] = [
    {
      id: "sales",
      icon: Store,
      title: t.salesCrm,
      desc: t.salesCrmDesc,
      features: [
        t.salesFeature1,
        t.salesFeature2,
        t.salesFeature3,
        t.salesFeature4,
      ],
    },
    {
      id: "rentals",
      icon: Home,
      title: t.rentalManagement,
      desc: t.rentalManagementDesc,
      features: [
        t.rentalFeature1,
        t.rentalFeature2,
        t.rentalFeature3,
        t.rentalFeature4,
      ],
    },
    {
      id: "maintenance",
      icon: Wrench,
      title: t.maintenance,
      desc: t.maintenanceDesc,
      features: [
        t.maintenanceFeature1,
        t.maintenanceFeature2,
        t.maintenanceFeature3,
        t.maintenanceFeature4,
      ],
    },
    {
      id: "finance",
      icon: CircleDollarSign,
      title: t.financeBilling,
      desc: t.financeBillingDesc,
      features: [
        t.financeFeature1,
        t.financeFeature2,
        t.financeFeature3,
        t.financeFeature4,
      ],
    },
  ];

  const [active, setActive] = useState(0);
  const activeTab = tabs[active]!;
  const ActiveIcon = activeTab.icon;

  return (
    <section id="features" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-primary dark:text-white sm:text-4xl">
            {t.featuresTitle}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t.featuresSubtitle}
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {tabs.map((tab, i) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(i)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors sm:px-5 ${
                  active === i
                    ? "bg-primary text-primary-foreground dark:bg-primary-deep dark:text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={{ display: "inline-flex" }}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">{tab.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="mt-8 grid items-center gap-12 lg:grid-cols-2">
          {/* Text side */}
          <div className={lang === "ar" ? "lg:order-2" : "lg:order-1"}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <ActiveIcon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-primary dark:text-white">
                {activeTab.title}
              </h3>
            </div>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              {activeTab.desc}
            </p>
            <ul className="mt-6 space-y-3">
              {activeTab.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Screenshot side */}
          <div className={lang === "ar" ? "lg:order-1" : "lg:order-2"}>
            <div className="overflow-hidden rounded-2xl border border-border bg-muted shadow-sm dark:bg-card">
              <Image
                src={`/assets/screenshots/${activeTab.id}.png`}
                alt={activeTab.title}
                width={1200}
                height={800}
                className="h-auto w-full"
                priority={activeTab.id === "sales"}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
