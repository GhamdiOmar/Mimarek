"use client";

import * as React from "react";
import { Blocks, Check, ChevronLeft } from "lucide-react";
import { Button, Badge, EmptyState, Skeleton, SARAmount, ConfirmDialog } from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { useLanguage } from "../../../../components/LanguageProvider";
import { ActionLink } from "@repo/ui";
import { sanitizeError } from "../../../../lib/error-sanitizer";
import { getAvailableAddOns, purchaseAddOn, cancelAddOn } from "../../../actions/add-ons";

type AddOn = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  pricingModel: string;
  priceMonthly: number | string;
  priceAnnual: number | string;
  billingDeferred: boolean;
};
type Owned = { addOnId: string; quantity: number };

const T = {
  ar: {
    title: "الإضافات", subtitle: "عزّز خطتك بإضافات قابلة للشراء.",
    back: "العودة للفوترة", owned: "مُفعّلة", buy: "شراء", cancel: "إلغاء",
    soon: "قريبًا", perMonth: "/شهر", perYear: "/سنة", saved: "تم الحفظ بنجاح",
    empty: "لا توجد إضافات متاحة", emptyDesc: "لا توجد إضافات لخطتك الحالية حاليًا.",
    confirmTitle: "إلغاء الإضافة", confirmDesc: "سيتم إلغاء هذه الإضافة وتعود الحدود فورًا.",
    confirmCta: "إلغاء الإضافة", keep: "تراجع",
  },
  en: {
    title: "Add-ons", subtitle: "Boost your plan with purchasable add-ons.",
    back: "Back to billing", owned: "Active", buy: "Purchase", cancel: "Cancel",
    soon: "Coming soon", perMonth: "/mo", perYear: "/yr", saved: "Saved successfully",
    empty: "No add-ons available", emptyDesc: "There are no add-ons for your current plan right now.",
    confirmTitle: "Cancel add-on", confirmDesc: "This add-on will be canceled and your limits revert immediately.",
    confirmCta: "Cancel add-on", keep: "Keep it",
  },
};

export default function BillingAddOnsPage() {
  const { lang } = useLanguage();
  const t = T[lang];
  const [addOns, setAddOns] = React.useState<AddOn[]>([]);
  const [owned, setOwned] = React.useState<Owned[]>([]);
  const [cycle, setCycle] = React.useState<string>("MONTHLY");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = (await getAvailableAddOns()) as { addOns: AddOn[]; owned: Owned[]; billingCycle: string };
        if (!alive) return;
        setAddOns(res.addOns);
        setOwned(res.owned);
        setCycle(res.billingCycle);
      } catch (err) {
        if (alive) setBanner({ ok: false, msg: sanitizeError(err, lang) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const isOwned = (id: string) => owned.some((o) => o.addOnId === id);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setBanner(null);
    try {
      await fn();
      setBanner({ ok: true, msg: t.saved });
      setTick((x) => x + 1);
    } catch (err) {
      setBanner({ ok: false, msg: sanitizeError(err, lang) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={<ActionLink href="/dashboard/billing" leadingIcon={ChevronLeft}>{t.back}</ActionLink>}
      />

      {banner && (
        <div role="status" className={`mb-4 rounded-lg border px-3 py-2 text-sm ${banner.ok ? "border-success/30 bg-success/10 text-success-strong" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {banner.msg}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
        </div>
      ) : addOns.length === 0 ? (
        <EmptyState icon={<Blocks className="h-12 w-12" />} title={t.empty} description={t.emptyDesc} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {addOns.map((a) => {
            const ownedHere = isOwned(a.id);
            const price = Number(cycle === "ANNUAL" ? a.priceAnnual : a.priceMonthly);
            return (
              <div key={a.id} className="card-quiet flex flex-col rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Blocks className="h-5 w-5" />
                  </div>
                  {ownedHere && <Badge variant="success" size="sm"><Check className="me-1 h-3 w-3" />{t.owned}</Badge>}
                  {a.billingDeferred && !ownedHere && <Badge variant="default" size="sm">{t.soon}</Badge>}
                </div>
                <h3 className="text-base font-semibold text-foreground">{lang === "ar" ? a.nameAr : a.nameEn}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{lang === "ar" ? a.descriptionAr : a.descriptionEn}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    <SARAmount value={price} />
                    <span className="text-xs font-normal text-muted-foreground">{cycle === "ANNUAL" ? t.perYear : t.perMonth}</span>
                  </span>
                  {ownedHere ? (
                    <Button variant="outline" size="sm" loading={busy === a.id} disabled={busy !== null} onClick={() => setConfirmCancel(a.id)}>
                      {t.cancel}
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" loading={busy === a.id} disabled={busy !== null || a.billingDeferred} onClick={() => run(a.id, () => purchaseAddOn(a.id, 1))}>
                      {t.buy}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel !== null}
        onOpenChange={(o) => !o && setConfirmCancel(null)}
        title={t.confirmTitle}
        description={t.confirmDesc}
        confirmLabel={t.confirmCta}
        cancelLabel={t.keep}
        variant="destructive"
        onConfirm={() => {
          const id = confirmCancel;
          setConfirmCancel(null);
          if (id) run(id, () => cancelAddOn(id));
        }}
      />
    </div>
  );
}
