"use client";

import * as React from "react";
import { AlertTriangle, Home, Send, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, Input, SelectField, Textarea } from "@repo/ui";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useLanguage } from "../../components/LanguageProvider";
import { createTenantMaintenanceRequest } from "../actions/portal";

type PortalSummary = {
  customer: { name: string };
  activeLease: PortalLease | null;
  maintenance: Array<{ id: string; title: string; status: string; priority: string; createdAt: string }>;
};

type PortalLease = {
  id: string;
  startDate: string;
  endDate: string;
  totalAmount: string | number;
  status: string;
  unit: { number: string; buildingName: string | null };
  installments: Array<{ id: string; dueDate: string; amount: string | number; status: string }>;
};

export default function PortalClient({ initialSummary }: { initialSummary: PortalSummary | null }) {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [summary, setSummary] = React.useState<PortalSummary | null>(initialSummary);
  const [loading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitStatus, setSubmitStatus] = React.useState<string>("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("GENERAL");
  const [priority, setPriority] = React.useState("MEDIUM");

  React.useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  async function submitMaintenance() {
    setSubmitting(true);
    setSubmitStatus("");
    try {
      const result = await createTenantMaintenanceRequest({ title, description, category, priority });
      if (!result.success) {
        const errorMsg = result.error ?? (t("تعذر إنشاء الطلب", "Could not create request"));
        toast.error(errorMsg);
        setSubmitStatus(errorMsg);
        return;
      }
      setTitle("");
      setDescription("");
      const successMsg = t("تم إرسال طلب الصيانة", "Maintenance request submitted");
      toast.success(successMsg);
      setSubmitStatus(successMsg);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const lease = summary?.activeLease;
  const paid = lease?.installments?.filter((item) => item.status === "PAID").length ?? 0;
  const totalInstallments = lease?.installments?.length ?? 0;

  return (
    <main className="min-h-dvh bg-background" dir={dir}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[2000] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t("تخطّي إلى المحتوى", "Skip to content")}
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">MIMAREK</p>
            <h1 className="text-xl font-bold">{t("بوابة المستأجر", "Tenant Portal")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              style={{ display: "inline-flex" }}
              aria-label={t("تغيير اللغة", "Switch language")}
            >
              {t("English", "العربية")}
            </Button>
          </div>
        </div>
      </header>

      <div id="main-content" className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:px-6">
        {loading ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground animate-pulse">{t("جاري التحميل...", "Loading...")}</div>
        ) : !summary ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {t("لا توجد بيانات متاحة لهذا الحساب.", "No portal data is available for this account.")}
            </CardContent>
          </Card>
        ) : (
          <>
            <section aria-labelledby="section-lease" className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardContent className="space-y-5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("مرحباً", "Welcome")}</p>
                      <h2 id="section-lease" className="text-2xl font-bold">{summary.customer.name}</h2>
                    </div>
                    <Badge variant="outline">{lease?.status ?? (t("لا يوجد عقد", "No lease"))}</Badge>
                  </div>
                  {lease ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <Metric label={t("الوحدة", "Unit")} value={`${lease.unit.buildingName ?? ""} ${lease.unit.number}`} icon={<Home className="h-4 w-4" />} />
                      <Metric label={t("مدة العقد", "Lease term")} value={`${date(lease.startDate)} - ${date(lease.endDate)}`} />
                      <Metric label={t("الإيجار", "Rent")} value={`${Number(lease.totalAmount).toLocaleString("en-US")} SAR`} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("لا يوجد عقد نشط مرتبط بهذا الحساب.", "No active lease is linked to this account.")}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-semibold">{t("حالة الدفعات", "Payment status")}</h3>
                  <div className="text-3xl font-bold">{paid}/{totalInstallments}</div>
                  <p className="text-sm text-muted-foreground">{t("دفعات مسددة من جدول الإيجار", "Paid installments from the rent schedule")}</p>
                  <div className="space-y-2">
                    {lease?.installments?.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                        <span>{date(item.dueDate)}</span>
                        <span className="font-medium">{Number(item.amount).toLocaleString("en-US")} SAR</span>
                        <Badge variant={item.status === "PAID" ? "available" : "outline"}>{item.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="section-maintenance-form" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="space-y-4 p-5">
                  <h3 id="section-maintenance-form" className="flex items-center gap-2 font-semibold"><Wrench className="h-5 w-5 text-primary" />{t("طلب صيانة", "Maintenance request")}</h3>
                  <label htmlFor="portal-request-title" className="space-y-2 text-sm font-medium">
                    {t("عنوان الطلب", "Request title")}
                    <Input id="portal-request-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("مثال: تسرب في المطبخ", "Example: Kitchen leak")} />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    {t("وصف المشكلة", "Issue description")}
                    <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("اكتب وصفاً مختصراً للمشكلة", "Write a short description of the issue")} />
                  </label>
                  <fieldset className="grid gap-3 md:grid-cols-2 border-0 p-0 m-0">
                    <legend className="sr-only">{t("تفاصيل الطلب", "Request details")}</legend>
                    <label className="space-y-2 text-sm font-medium">
                      {t("الفئة", "Category")}
                      <SelectField aria-label={t("الفئة", "Category")} value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                        {["GENERAL", "PLUMBING", "ELECTRICAL", "HVAC", "ELEVATOR"].map((item) => <option key={item} value={item}>{item}</option>)}
                      </SelectField>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      {t("الأولوية", "Priority")}
                      <SelectField aria-label={t("الأولوية", "Priority")} value={priority} onChange={(event) => setPriority(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                        {["LOW", "MEDIUM", "HIGH", "URGENT"].map((item) => <option key={item} value={item}>{item}</option>)}
                      </SelectField>
                    </label>
                  </fieldset>
                  <Button onClick={submitMaintenance} disabled={!title} loading={submitting} style={{ display: "inline-flex" }}>
                    <Send className="h-4 w-4" />
                    {t("إرسال الطلب", "Submit request")}
                  </Button>
                  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                    {submitStatus}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="section-maintenance-tracking">
              <Card>
                <CardContent className="space-y-4 p-5">
                  <h3 id="section-maintenance-tracking" className="font-semibold">{t("متابعة الصيانة", "Maintenance tracking")}</h3>
                  {summary.maintenance.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("لا توجد طلبات صيانة بعد.", "No maintenance requests yet.")}</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {summary.maintenance.map((request) => (
                        <div key={request.id} className="rounded-md border border-border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{request.title}</p>
                            <Badge variant="outline">{request.status}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{date(request.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function date(value: string | Date) {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
