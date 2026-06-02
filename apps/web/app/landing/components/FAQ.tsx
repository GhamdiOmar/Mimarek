"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui";
import { t as translations } from "../translations";

export default function FAQ({ lang }: { lang: "ar" | "en" }) {
  const t = translations[lang];

  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
    { q: t.faq5Q, a: t.faq5A },
    { q: t.faq6Q, a: t.faq6A },
    { q: t.faq7Q, a: t.faq7A },
  ];

  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold text-primary dark:text-white sm:text-4xl">
          {t.faqTitle}
        </h2>

        <div className="mt-12 space-y-2">
          {faqs.map(({ q, a }, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/50 bg-card/50 dark:bg-card/30"
            >
              <Button
                variant="ghost"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start h-auto rounded-none"
              >
                <span className="text-base font-semibold text-primary dark:text-white">
                  {q}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    open === i ? "rotate-180" : ""
                  }`}
                />
              </Button>
              {open === i && (
                <div className="px-5 pb-4">
                  <p className="leading-relaxed text-muted-foreground">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
