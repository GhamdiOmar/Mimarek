"use client";

import * as React from "react";
import {
  ArrowLeft,
  Plug,
  CreditCard,
  CheckCircle2,
  ReceiptText,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Input,
  Switch,
  ActionLink,
  DirectionalIcon,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { useLanguage } from "../../../../components/LanguageProvider";
import { sanitizeError } from "../../../../lib/error-sanitizer";
import {
  upsertMoyasarCredentials,
  type GatewayConfigSummary,
} from "../../../actions/payment/gateway-config";

type IntegrationsViewProps = {
  summary: GatewayConfigSummary;
};

function formatDateTime(value: string | null, lang: "ar" | "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IntegrationsView({ summary: initialSummary }: IntegrationsViewProps) {
  const { t, lang } = useLanguage();
  const [isPending, startTransition] = React.useTransition();

  // The secret-free summary is the source of truth for the read-only status
  // (has* booleans, mode, flags, last-updated). It is refreshed from the server
  // action's return value after every successful save.
  const [summary, setSummary] = React.useState<GatewayConfigSummary>(initialSummary);

  // Write-only secret inputs — never pre-filled (the server never returns a
  // decrypted secret). Leaving a field blank keeps the existing stored secret.
  const [apiKey, setApiKey] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");
  const [publishableKey, setPublishableKey] = React.useState("");

  // Non-secret config — seeded from the summary so the controls reflect the
  // stored state, then edited locally before save.
  const [mode, setMode] = React.useState<"test" | "live">(initialSummary.mode);
  const [isEnabled, setIsEnabled] = React.useState(initialSummary.isEnabled);
  const [isPrimary, setIsPrimary] = React.useState(initialSummary.isPrimary);

  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const onSave = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);

      startTransition(async () => {
        try {
          const next = await upsertMoyasarCredentials({
            // Only send non-empty secrets — blank keeps the stored value.
            apiKey: apiKey.trim() || undefined,
            webhookSecret: webhookSecret.trim() || undefined,
            publishableKey: publishableKey.trim() || undefined,
            mode,
            isEnabled,
            isPrimary,
          });
          setSummary(next);
          // Clear the write-only inputs so a stored secret is never implied to
          // be still in the field.
          setApiKey("");
          setWebhookSecret("");
          setPublishableKey("");
          setSuccess(
            t("تم حفظ بيانات الاعتماد بنجاح.", "Credentials saved successfully."),
          );
        } catch (err) {
          setError(sanitizeError(err, lang));
        }
      });
    },
    [apiKey, webhookSecret, publishableKey, mode, isEnabled, isPrimary, t, lang],
  );

  // Per-field presence helper — "Configured ✓" (already stored) vs "Not set".
  const fieldStatus = (configured: boolean) =>
    configured ? (
      <span className="inline-flex items-center gap-1 text-success">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t("مُهيّأ", "Configured")}
      </span>
    ) : (
      <span className="text-muted-foreground">{t("غير مُعرّف", "Not set")}</span>
    );

  return (
    <div
      className="space-y-8 animate-in fade-in duration-500"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* Back link */}
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" />
        {t("إدارة المنصة", "Platform Administration")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Plug className="h-7 w-7" aria-hidden="true" />
        </div>
        <PageHeader
          className="flex-1"
          title={t("التكاملات", "Integrations")}
          description={t(
            "أدِر بيانات اعتماد بوابات الدفع وتكاملات المنصة. تُخزَّن الأسرار مشفّرة ولا تُعرَض بعد الحفظ.",
            "Manage payment-gateway credentials and platform integrations. Secrets are stored encrypted and never shown after saving.",
          )}
        />
      </div>

      {/* ─── Moyasar payment gateway ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("بوابة الدفع — ميسر", "Payment gateway — Moyasar")}
            </CardTitle>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Badge variant={summary.isEnabled ? "success" : "default"} size="sm">
                {summary.isEnabled ? t("مُفعّلة", "Enabled") : t("معطّلة", "Disabled")}
              </Badge>
              {summary.isPrimary && (
                <Badge variant="default" size="sm">
                  {t("الأساسية", "Primary")}
                </Badge>
              )}
              <Badge variant={summary.mode === "live" ? "warning" : "info"} size="sm">
                {summary.mode === "live" ? t("مباشر", "Live") : t("تجريبي", "Test")}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-xs text-muted-foreground">
            {t(
              "اترك أي حقل فارغًا للإبقاء على السر المخزَّن الحالي. الأسرار مشفّرة على الخادم ولا تعود أبدًا إلى المتصفح.",
              "Leave any field blank to keep the currently stored secret. Secrets are encrypted server-side and never returned to the browser.",
            )}
          </p>

          <form onSubmit={onSave} className="space-y-6">
            {/* Secret inputs — write-only, password type */}
            <div className="space-y-5">
              {/* API key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="moyasar-api-key" className="block text-xs font-semibold text-foreground">
                    {t("مفتاح الواجهة البرمجية (السرّي)", "API key (secret)")}
                  </label>
                  <span className="text-[11px]">{fieldStatus(summary.hasApiKey)}</span>
                </div>
                <Input
                  id="moyasar-api-key"
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono"
                  placeholder={t("اتركه فارغًا للإبقاء على الحالي", "Leave blank to keep current")}
                />
              </div>

              {/* Webhook secret */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="moyasar-webhook-secret" className="block text-xs font-semibold text-foreground">
                    {t("سرّ الويب هوك", "Webhook secret")}
                  </label>
                  <span className="text-[11px]">{fieldStatus(summary.hasWebhookSecret)}</span>
                </div>
                <Input
                  id="moyasar-webhook-secret"
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="font-mono"
                  placeholder={t("اتركه فارغًا للإبقاء على الحالي", "Leave blank to keep current")}
                />
              </div>

              {/* Publishable key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="moyasar-publishable-key" className="block text-xs font-semibold text-foreground">
                    {t("المفتاح العام", "Publishable key")}
                  </label>
                  <span className="text-[11px]">{fieldStatus(summary.hasPublishableKey)}</span>
                </div>
                <Input
                  id="moyasar-publishable-key"
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                  className="font-mono"
                  placeholder={t("اتركه فارغًا للإبقاء على الحالي", "Leave blank to keep current")}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "المفتاح العام يُستخدم في الواجهة الأمامية لتهيئة نموذج الدفع.",
                    "The publishable key is used on the front-end to initialize the payment form.",
                  )}
                </p>
              </div>
            </div>

            {/* Mode — test/live segmented pills (§6.6.8) */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-foreground">
                {t("وضع البوابة", "Gateway mode")}
              </span>
              <div className="flex items-center gap-1.5" role="group" aria-label={t("وضع البوابة", "Gateway mode")}>
                {(["test", "live"] as const).map((m) => {
                  const active = mode === m;
                  return (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={active ? "primary" : "subtle"}
                      aria-pressed={active}
                      className="rounded-full"
                      onClick={() => setMode(m)}
                    >
                      {m === "live" ? t("مباشر", "Live") : t("تجريبي", "Test")}
                    </Button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "استخدم الوضع التجريبي أثناء الإعداد؛ حوِّل إلى المباشر عند الجاهزية لاستقبال مدفوعات حقيقية.",
                  "Use test while setting up; switch to live when ready to accept real payments.",
                )}
              </p>
            </div>

            {/* Enabled + Primary toggles */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <label htmlFor="moyasar-enabled" className="block text-xs font-semibold text-foreground">
                    {t("تفعيل البوابة", "Enable gateway")}
                  </label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("اسمح بمعالجة المدفوعات عبر ميسر.", "Allow processing payments through Moyasar.")}
                  </p>
                </div>
                <Switch
                  id="moyasar-enabled"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                  aria-label={t("تفعيل البوابة", "Enable gateway")}
                />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <label htmlFor="moyasar-primary" className="block text-xs font-semibold text-foreground">
                    {t("تعيين كبوابة أساسية", "Set as primary")}
                  </label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("استخدمها كبوابة الدفع الافتراضية.", "Use it as the default payment gateway.")}
                  </p>
                </div>
                <Switch
                  id="moyasar-primary"
                  checked={isPrimary}
                  onCheckedChange={setIsPrimary}
                  aria-label={t("تعيين كبوابة أساسية", "Set as primary")}
                />
              </div>
            </div>

            {/* Feedback banners */}
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {error}
              </p>
            )}
            {success && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-md border border-success bg-success/10 px-3 py-2 text-xs text-success"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {success}
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted-foreground">
                {t("آخر تحديث: ", "Last updated: ")}
                <span dir="ltr" className="tabular-nums">
                  {formatDateTime(summary.updatedAt, lang)}
                </span>
              </p>
              <Button
                type="submit"
                disabled={isPending}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                {isPending
                  ? t("جارٍ الحفظ…", "Saving…")
                  : t("حفظ بيانات الاعتماد", "Save credentials")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ─── ZATCA e-invoicing status ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ReceiptText className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("الفوترة الإلكترونية — زاتكا", "E-invoicing — ZATCA")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">
            {t(
              "تُدار تهيئة جهاز إصدار الفواتير وحالة الاعتماد مع هيئة الزكاة والضريبة والجمارك من صفحة زاتكا المخصّصة.",
              "The billing EGS onboarding and ZATCA clearance status are managed on the dedicated ZATCA page.",
            )}
          </p>
          <ActionLink href="/dashboard/admin/zatca" trailingIcon={ChevronLeft} directional>
            {t("إدارة الفوترة الإلكترونية (زاتكا)", "Manage ZATCA e-invoicing")}
          </ActionLink>
        </CardContent>
      </Card>
    </div>
  );
}
