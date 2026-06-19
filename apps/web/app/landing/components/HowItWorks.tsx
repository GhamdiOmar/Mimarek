"use client";

import { UserPlus, Settings, TrendingUp } from "lucide-react";
import { t as translations } from "../translations";

export default function HowItWorks({ lang }: { lang: "ar" | "en" }) {
  const t = translations[lang];

  const steps = [
    {
      icon: UserPlus,
      num: "1",
      title: t.step1Title,
      desc: t.step1Desc,
    },
    {
      icon: Settings,
      num: "2",
      title: t.step2Title,
      desc: t.step2Desc,
    },
    {
      icon: TrendingUp,
      num: "3",
      title: t.step3Title,
      desc: t.step3Desc,
    },
  ];

  return (
    <section id="how-it-works" className="bg-muted/30 py-20 dark:bg-muted/10 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-primary dark:text-white sm:text-4xl">
            {t.howItWorksTitle}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t.howItWorksSubtitle}
          </p>
        </div>

        <div className="relative mt-16">
          {/* Connecting line */}
          <div className="absolute top-14 hidden h-px bg-border sm:inset-x-0 sm:block" />

          <div className="grid gap-12 sm:grid-cols-3 sm:gap-8">
            {steps.map(({ icon: Icon, num, title, desc }) => (
              <div key={num} className="relative text-center">
                {/* Step number badge — single circle */}
                <div className="relative z-10 mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm">
                  {num}
                </div>

                <div className="mt-6 rounded-2xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur-sm dark:bg-card/50">
                  <div className="flex justify-center">
                    <Icon className="h-7 w-7 text-primary dark:text-white" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-primary dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
