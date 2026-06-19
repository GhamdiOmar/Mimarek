"use client";

import { t as translations } from "../translations";

export default function Stats({ lang }: { lang: "ar" | "en" }) {
  const t = translations[lang];

  const stats = [
    { value: t.statVat, label: t.statVatLabel },
    { value: t.statCompliance, label: t.statComplianceLabel },
    { value: t.statTrial, label: t.statTrialLabel },
    { value: t.statPlans, label: t.statPlansLabel },
  ];

  return (
    <section id="stats" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold text-primary dark:text-white sm:text-4xl">
          {t.statsTitle}
        </h2>

        {/* Factual product stats only */}
        <div className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map(({ value, label }) => (
            <div
              key={label}
              className="rounded-2xl border border-border/50 bg-card/80 p-6 text-center shadow-sm backdrop-blur-sm transition-shadow duration-300 hover:shadow-md dark:bg-card/50"
            >
              <p className="text-3xl font-bold text-primary dark:text-white sm:text-4xl">
                {value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
