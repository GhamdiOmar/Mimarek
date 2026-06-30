"use client";

import * as React from "react";
import { Blocks, Plus, Pencil } from "lucide-react";
import {
  Button,
  IconButton,
  AppBar,
  DataCard,
  DataTable,
  EmptyState,
  FAB,
  Skeleton,
  Badge,
  Switch,
  Input,
  SelectField,
  SARAmountInput,
  ResponsiveDialog,
  type ColumnDef,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { useLanguage } from "../../../../components/LanguageProvider";
import { useSession } from "../../../../components/SimpleSessionProvider";
import { isSystemRole } from "../../../../lib/permissions";
import { sanitizeError } from "../../../../lib/error-sanitizer";
import { adminGetAddOns, adminCreateAddOn, adminUpdateAddOn, adminToggleAddOn } from "../../../actions/add-ons";
import { adminGetAllPlans } from "../../../actions/billing";
import { GRANTABLE_FEATURE_KEYS } from "../../../../lib/entitlements/keys";

type PlanRef = { id: string; slug: string; nameEn: string };
type AddOnRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  pricingModel: string;
  priceMonthly: number | string;
  priceAnnual: number | string;
  grantsFeatureKey: string | null;
  grantsType: string | null;
  grantsValue: string | null;
  limitMode: string;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
  plans: PlanRef[];
  _count?: { subscriptions: number };
};
type PlanOpt = { id: string; slug: string; nameEn: string; nameAr: string };

const PRICING_MODELS = ["FLAT", "PER_SEAT", "PER_UNIT", "PER_INVOICE", "USAGE", "CUSTOM"] as const;

const T = {
  ar: {
    title: "الإضافات", subtitle: "إضافات قابلة للبيع ترفع حدود الخطة أو تفعّل ميزات.",
    unauthorized: "غير مصرح", unauthorizedDesc: "هذه الصفحة متاحة لموظفي المنصة فقط.",
    empty: "لا توجد إضافات بعد", emptyDesc: "أنشئ أول إضافة قابلة للبيع لرفع حدود الخطط.",
    create: "إضافة جديدة", edit: "تعديل", name: "الاسم", grants: "تمنح", pricing: "السعر",
    plans: "الخطط", allPlans: "كل الخطط", active: "نشطة", actions: "إجراءات",
    monthly: "شهري", annual: "سنوي", perMonth: "/شهر", perYear: "/سنة",
    slug: "المعرّف (slug)", nameEn: "الاسم (إنجليزي)", nameAr: "الاسم (عربي)",
    descEn: "الوصف (إنجليزي)", descAr: "الوصف (عربي)", pricingModel: "نموذج التسعير",
    featureKey: "مفتاح الميزة الممنوحة", grantType: "النوع", grantValue: "القيمة",
    limitMode: "وضع الحد", additive: "إضافي (يُجمع)", override: "استبدال",
    public: "متاحة للشراء الذاتي", isActive: "نشطة", save: "حفظ", cancel: "إلغاء", close: "إغلاق",
    saved: "تم الحفظ بنجاح", purchases: "عمليات الشراء",
    valueHint: "للحدود: رقم أو \"unlimited\". للمنطقية: true.",
    none: "—", boolean: "منطقية", limit: "حد",
  },
  en: {
    title: "Add-ons", subtitle: "Sellable add-ons that raise plan limits or unlock features.",
    unauthorized: "Unauthorized", unauthorizedDesc: "This page is available to platform staff only.",
    empty: "No add-ons yet", emptyDesc: "Create the first sellable add-on to raise plan limits.",
    create: "New add-on", edit: "Edit", name: "Name", grants: "Grants", pricing: "Pricing",
    plans: "Plans", allPlans: "All plans", active: "Active", actions: "Actions",
    monthly: "Monthly", annual: "Annual", perMonth: "/mo", perYear: "/yr",
    slug: "Slug", nameEn: "Name (English)", nameAr: "Name (Arabic)",
    descEn: "Description (English)", descAr: "Description (Arabic)", pricingModel: "Pricing model",
    featureKey: "Granted feature key", grantType: "Type", grantValue: "Value",
    limitMode: "Limit mode", additive: "Additive (stacks)", override: "Override (replace)",
    public: "Self-serve purchasable", isActive: "Active", save: "Save", cancel: "Cancel", close: "Close",
    saved: "Saved successfully", purchases: "Purchases",
    valueHint: 'For limits: a number or "unlimited". For boolean: true.',
    none: "—", boolean: "Boolean", limit: "Limit",
  },
};

type FormState = {
  id: string | null;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  pricingModel: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  grantsFeatureKey: string;
  grantsType: string;
  grantsValue: string;
  limitMode: string;
  isPublic: boolean;
  isActive: boolean;
  planIds: string[];
};

const emptyForm = (): FormState => ({
  id: null, slug: "", nameEn: "", nameAr: "", descriptionEn: "", descriptionAr: "",
  pricingModel: "FLAT", priceMonthly: 0, priceAnnual: 0,
  grantsFeatureKey: "units.max", grantsType: "LIMIT", grantsValue: "",
  limitMode: "ADDITIVE", isPublic: true, isActive: true, planIds: [],
});

export default function AdminAddOnsPage() {
  const { lang } = useLanguage();
  const t = T[lang];
  const { data: session } = useSession();
  const authorized = isSystemRole(session?.user?.role ?? "");

  const [addOns, setAddOns] = React.useState<AddOnRow[]>([]);
  const [plans, setPlans] = React.useState<PlanOpt[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!authorized) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const [a, p] = await Promise.all([adminGetAddOns(), adminGetAllPlans()]);
        if (!alive) return;
        setAddOns(a as AddOnRow[]);
        setPlans((p as PlanOpt[]).map((x) => ({ id: x.id, slug: x.slug, nameEn: x.nameEn, nameAr: x.nameAr })));
      } catch (err) {
        if (alive) setBanner({ ok: false, msg: sanitizeError(err, lang) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, tick]);

  function openCreate() { setForm(emptyForm()); setBanner(null); setDialogOpen(true); }
  function openEdit(r: AddOnRow) {
    setForm({
      id: r.id, slug: r.slug, nameEn: r.nameEn, nameAr: r.nameAr,
      descriptionEn: r.descriptionEn ?? "", descriptionAr: r.descriptionAr ?? "",
      pricingModel: r.pricingModel, priceMonthly: Number(r.priceMonthly), priceAnnual: Number(r.priceAnnual),
      grantsFeatureKey: r.grantsFeatureKey ?? "units.max", grantsType: r.grantsType ?? "LIMIT",
      grantsValue: r.grantsValue ?? "", limitMode: r.limitMode, isPublic: r.isPublic, isActive: r.isActive,
      planIds: r.plans.map((p) => p.id),
    });
    setBanner(null);
    setDialogOpen(true);
  }

  async function submit() {
    setBusy(true);
    setBanner(null);
    try {
      const data = {
        slug: form.slug, nameEn: form.nameEn, nameAr: form.nameAr,
        descriptionEn: form.descriptionEn, descriptionAr: form.descriptionAr,
        pricingModel: form.pricingModel as Parameters<typeof adminCreateAddOn>[0]["pricingModel"],
        priceMonthly: form.priceMonthly ?? 0, priceAnnual: form.priceAnnual ?? 0,
        grantsFeatureKey: form.grantsFeatureKey,
        grantsType: form.grantsType as "BOOLEAN" | "LIMIT" | "METERED",
        grantsValue: form.grantsValue,
        limitMode: form.limitMode as "ADDITIVE" | "OVERRIDE",
        isPublic: form.isPublic, isActive: form.isActive, planIds: form.planIds,
      };
      if (form.id) await adminUpdateAddOn(form.id, data);
      else await adminCreateAddOn(data);
      setDialogOpen(false);
      setTick((x) => x + 1);
    } catch (err) {
      setBanner({ ok: false, msg: sanitizeError(err, lang) });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: AddOnRow, next: boolean) {
    try {
      await adminToggleAddOn(r.id, next);
      setAddOns((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: next } : x)));
    } catch (err) {
      setBanner({ ok: false, msg: sanitizeError(err, lang) });
    }
  }

  const sar = (v: number | string) =>
    `${Number(v).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US")} ${lang === "ar" ? "ر.س" : "SAR"}`;
  const grantLabel = (r: AddOnRow) =>
    r.grantsFeatureKey ? `${r.grantsFeatureKey} = ${r.grantsValue ?? ""}${r.grantsType === "LIMIT" && r.limitMode === "ADDITIVE" ? " (+)" : ""}` : t.none;

  const columns: ColumnDef<AddOnRow>[] = [
    {
      accessorKey: "nameEn",
      header: t.name,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{lang === "ar" ? row.original.nameAr : row.original.nameEn}</span>
          <span className="font-mono text-xs text-muted-foreground" dir="ltr">{row.original.slug}</span>
        </div>
      ),
    },
    {
      id: "grants",
      header: t.grants,
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-xs" dir="ltr">{grantLabel(row.original)}</span>,
    },
    {
      id: "pricing",
      header: t.pricing,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums" dir="ltr">
          {sar(row.original.priceMonthly)}{t.perMonth} · {sar(row.original.priceAnnual)}{t.perYear}
        </span>
      ),
    },
    {
      id: "plans",
      header: t.plans,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.plans.length === 0 ? (
          <Badge variant="info" size="sm">{t.allPlans}</Badge>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.original.plans.map((p) => (<Badge key={p.id} variant="default" size="sm">{p.slug}</Badge>))}
          </div>
        ),
    },
    {
      id: "active",
      header: t.active,
      enableSorting: false,
      cell: ({ row }) => (
        <Switch
          checked={row.original.isActive}
          onCheckedChange={(v) => toggle(row.original, v)}
          aria-label={`${t.isActive}: ${row.original.nameEn}`}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton icon={Pencil} aria-label={t.edit} variant="ghost" onClick={() => openEdit(row.original)} />
        </div>
      ),
    },
  ];

  if (!authorized) {
    return (
      <div className="py-16">
        <EmptyState icon={<Blocks className="h-12 w-12" />} title={t.unauthorized} description={t.unauthorizedDesc} />
      </div>
    );
  }

  return (
    <>
      {/* Mobile */}
      <div className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background" dir={lang === "ar" ? "rtl" : "ltr"}>
        <AppBar title={t.title} lang={lang} />
        <div className="flex-1 space-y-3 px-4 pt-4 pb-24">
          {loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
          ) : addOns.length === 0 ? (
            <EmptyState icon={<Blocks className="h-12 w-12" />} title={t.empty} description={t.emptyDesc}
              action={<Button onClick={openCreate}>{t.create}</Button>} />
          ) : (
            addOns.map((r, i) => (
              <DataCard
                key={r.id}
                icon={Blocks}
                iconTone="primary"
                onClick={() => openEdit(r)}
                title={lang === "ar" ? r.nameAr : r.nameEn}
                subtitle={
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono text-xs" dir="ltr">{grantLabel(r)}</span>
                    {!r.isActive && <Badge variant="default" size="sm">{lang === "ar" ? "متوقفة" : "Inactive"}</Badge>}
                  </span>
                }
                trailing={<span className="text-sm tabular-nums" dir="ltr">{sar(r.priceMonthly)}{t.perMonth}</span>}
                divider={i !== addOns.length - 1}
              />
            ))
          )}
        </div>
        <FAB icon={Plus} label={t.create} onClick={openCreate} />
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <PageHeader
          title={t.title}
          description={t.subtitle}
          actions={<Button onClick={openCreate}><Plus className="h-4 w-4" />{t.create}</Button>}
        />
        {banner && (
          <div role="status" className={`mb-4 rounded-lg border px-3 py-2 text-sm ${banner.ok ? "border-success/30 bg-success/10 text-success-strong" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            {banner.msg}
          </div>
        )}
        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
        ) : addOns.length === 0 ? (
          <EmptyState icon={<Blocks className="h-12 w-12" />} title={t.empty} description={t.emptyDesc}
            action={<Button onClick={openCreate}>{t.create}</Button>} />
        ) : (
          <DataTable columns={columns} data={addOns} />
        )}
      </div>

      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={form.id ? t.edit : t.create}
        description={t.subtitle}
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t.close}</Button>
            <Button variant="primary" loading={busy} disabled={busy || !form.slug.trim() || !form.nameEn.trim() || !form.nameAr.trim()} onClick={submit}>
              {t.save}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {banner && !banner.ok && (
            <div role="status" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner.msg}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.slug}</span>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} dir="ltr" disabled={!!form.id} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.nameEn}</span>
              <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.nameAr}</span>
              <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.descEn}</span>
              <Input value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} dir="ltr" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.descAr}</span>
              <Input value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} dir="rtl" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.pricingModel}</span>
              <SelectField value={form.pricingModel} onChange={(e) => setForm({ ...form, pricingModel: e.target.value })} aria-label={t.pricingModel}>
                {PRICING_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </SelectField>
            </label>
            <div />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.monthly}</span>
              <SARAmountInput value={form.priceMonthly} onChange={(v) => setForm({ ...form, priceMonthly: v })} locale={lang} aria-label={t.monthly} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.annual}</span>
              <SARAmountInput value={form.priceAnnual} onChange={(v) => setForm({ ...form, priceAnnual: v })} locale={lang} aria-label={t.annual} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.featureKey}</span>
              <SelectField value={form.grantsFeatureKey} onChange={(e) => setForm({ ...form, grantsFeatureKey: e.target.value })} aria-label={t.featureKey}>
                {GRANTABLE_FEATURE_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </SelectField>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.grantType}</span>
              <SelectField value={form.grantsType} onChange={(e) => setForm({ ...form, grantsType: e.target.value })} aria-label={t.grantType}>
                <option value="LIMIT">{t.limit}</option>
                <option value="BOOLEAN">{t.boolean}</option>
              </SelectField>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.grantValue}</span>
              <Input value={form.grantsValue} onChange={(e) => setForm({ ...form, grantsValue: e.target.value })} dir="ltr" placeholder={t.valueHint} />
            </label>
            {form.grantsType === "LIMIT" && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">{t.limitMode}</span>
                <SelectField value={form.limitMode} onChange={(e) => setForm({ ...form, limitMode: e.target.value })} aria-label={t.limitMode}>
                  <option value="ADDITIVE">{t.additive}</option>
                  <option value="OVERRIDE">{t.override}</option>
                </SelectField>
              </label>
            )}
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-foreground">{t.plans} ({t.allPlans} = {plans.length === form.planIds.length || form.planIds.length === 0 ? t.allPlans : ""})</span>
            <div className="flex flex-wrap gap-2">
              {plans.map((p) => {
                const on = form.planIds.includes(p.id);
                return (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={on ? "primary" : "subtle"}
                    className="rounded-full"
                    aria-pressed={on}
                    onClick={() => setForm({ ...form, planIds: on ? form.planIds.filter((x) => x !== p.id) : [...form.planIds, p.id] })}
                  >
                    {lang === "ar" ? p.nameAr : p.nameEn}
                  </Button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{lang === "ar" ? "بدون اختيار = متاحة لكل الخطط." : "None selected = available on all plans."}</p>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isPublic} onCheckedChange={(v) => setForm({ ...form, isPublic: v })} aria-label={t.public} />
              <span className="text-foreground">{t.public}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} aria-label={t.isActive} />
              <span className="text-foreground">{t.isActive}</span>
            </label>
          </div>
        </div>
      </ResponsiveDialog>
    </>
  );
}
