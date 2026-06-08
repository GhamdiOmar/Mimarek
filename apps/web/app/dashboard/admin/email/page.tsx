"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, KeyRound, Mail, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Switch } from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { useLanguage } from "../../../../components/LanguageProvider";
import {
  clearSmtpPasswordAction,
  getEmailSettingsAction,
  saveEmailSettingsAction,
  sendTestEmailAction,
} from "../../../actions/email-settings";

type EmailSettingsState = {
  emailProvider: string;
  emailEnabled: boolean;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPasswordLast4: string | null;
  emailTestRecipient: string;
  emailLastTestAt: Date | string | null;
  emailLastTestStatus: string | null;
  emailLastTestMessage: string | null;
  hasSmtpPassword: boolean;
};

const defaults: EmailSettingsState = {
  emailProvider: "HOSTINGER_SMTP",
  emailEnabled: false,
  emailFromName: "Mimaric",
  emailFromAddress: "",
  emailReplyTo: "",
  smtpHost: "smtp.hostinger.com",
  smtpPort: 465,
  smtpSecure: true,
  smtpUsername: "",
  smtpPasswordLast4: null,
  emailTestRecipient: "",
  emailLastTestAt: null,
  emailLastTestStatus: null,
  emailLastTestMessage: null,
  hasSmtpPassword: false,
};

const copy = {
  ar: {
    title: "إعدادات البريد",
    description: "ربط ميماريك ببريد Hostinger SMTP لإرسال رسائل إعادة كلمة المرور والدعوات.",
    save: "حفظ إعدادات البريد",
    test: "إرسال بريد اختبار",
    clear: "حذف كلمة مرور SMTP",
    checklist: "نسخ قائمة Hostinger",
    provider: "المزود",
    enabled: "تفعيل إرسال البريد",
    host: "SMTP host",
    port: "SMTP port",
    encryption: "التشفير",
    username: "اسم مستخدم SMTP",
    password: "كلمة مرور SMTP",
    passwordHint: "تكتب مرة واحدة وتظهر لاحقاً كقيمة مخفية فقط.",
    fromName: "اسم المرسل",
    fromEmail: "بريد المرسل",
    replyTo: "بريد الرد (اختياري)",
    recipient: "مستلم الاختبار",
    status: "حالة الإعداد",
    configured: "كلمة المرور محفوظة",
    notConfigured: "كلمة المرور غير محفوظة",
    setup: "قائمة إعداد Hostinger",
    saved: "تم حفظ إعدادات البريد",
    failed: "تعذر تنفيذ الإجراء",
    copied: "تم نسخ القائمة",
    lastPassed: "آخر اختبار ناجح",
    lastFailed: "آخر اختبار فشل",
  },
  en: {
    title: "Email Settings",
    description: "Connect Mimaric to Hostinger SMTP for password reset, invitations, and future transactional email.",
    save: "Save email settings",
    test: "Send test email",
    clear: "Clear SMTP password",
    checklist: "Copy Hostinger SMTP checklist",
    provider: "Provider",
    enabled: "Enable email sending",
    host: "SMTP host",
    port: "SMTP port",
    encryption: "Encryption",
    username: "SMTP username",
    password: "SMTP password",
    passwordHint: "Write-only. After saving, Mimaric only shows that a password is configured.",
    fromName: "From name",
    fromEmail: "From email",
    replyTo: "Reply-to email (optional)",
    recipient: "Test recipient email",
    status: "Configuration status",
    configured: "SMTP password configured",
    notConfigured: "SMTP password not configured",
    setup: "Hostinger setup checklist",
    saved: "Email settings saved",
    failed: "Action failed",
    copied: "Checklist copied",
    lastPassed: "Last test passed",
    lastFailed: "Last test failed",
  },
};

export default function AdminEmailSettingsPage() {
  const { lang } = useLanguage();
  const t = copy[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [form, setForm] = useState<EmailSettingsState>(defaults);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const checklist = useMemo(
    () =>
      [
        "Create the mailbox in Hostinger, for example noreply@yourdomain.com.",
        "Confirm the domain uses the DNS provider where you will edit records.",
        "Configure Hostinger MX records.",
        "Configure SPF for Hostinger mail.",
        "Enable DKIM in Hostinger and publish the DKIM record.",
        "Add a DMARC record.",
        "Return to Mimaric, save SMTP settings, then send a test email.",
      ].join("\n"),
    [],
  );

  const load = useCallback(async () => {
    try {
      const settings = await getEmailSettingsAction();
      setForm({
        ...defaults,
        ...settings,
        emailReplyTo: settings.emailReplyTo ?? "",
        emailTestRecipient: settings.emailTestRecipient ?? "",
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof EmailSettingsState>(key: K, value: EmailSettingsState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await saveEmailSettingsAction({ ...form, smtpPassword });
      setSmtpPassword("");
      await load();
      toast.success(t.saved);
    } catch {
      toast.error(t.failed);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const result = await sendTestEmailAction(form.emailTestRecipient || form.emailFromAddress);
      await load();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.failed);
    } finally {
      setTesting(false);
    }
  }

  async function clearPassword() {
    setClearing(true);
    try {
      await clearSmtpPasswordAction();
      setSmtpPassword("");
      await load();
      toast.success(lang === "ar" ? "تم حذف كلمة المرور" : "SMTP password cleared");
    } catch {
      toast.error(t.failed);
    } finally {
      setClearing(false);
    }
  }

  async function copyChecklist() {
    try {
      await navigator.clipboard.writeText(checklist);
      toast.success(t.copied);
    } catch {
      toast.error(lang === "ar" ? "تعذر نسخ القائمة. حدّد النص من القائمة وانسخه يدوياً." : "Could not copy the checklist. Select the checklist text and copy it manually.");
    }
  }

  const ready = form.emailEnabled && form.smtpHost && form.smtpUsername && form.emailFromAddress && form.hasSmtpPassword;

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir={dir} suppressHydrationWarning>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={copyChecklist} style={{ display: "inline-flex" }}>
              <ClipboardCopy className="h-4 w-4" />
              {t.checklist}
            </Button>
            <Button type="button" onClick={save} loading={saving} style={{ display: "inline-flex" }}>
              <Save className="h-4 w-4" />
              {t.save}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" />
              Hostinger SMTP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                {t.provider}
                <Input value="Hostinger SMTP" disabled />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm font-medium">
                <span>{t.enabled}</span>
                <Switch checked={form.emailEnabled} onCheckedChange={(checked) => update("emailEnabled", checked)} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                {t.host}
                <Input value={form.smtpHost} onChange={(e) => update("smtpHost", e.target.value)} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                {t.port}
                <Input
                  type="number"
                  value={form.smtpPort}
                  onChange={(e) => {
                    const port = Number(e.target.value);
                    update("smtpPort", port);
                    update("smtpSecure", port === 465);
                  }}
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                {t.encryption}
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.smtpSecure ? "ssl" : "starttls"}
                  onChange={(e) => {
                    const ssl = e.target.value === "ssl";
                    update("smtpSecure", ssl);
                    update("smtpPort", ssl ? 465 : 587);
                  }}
                >
                  <option value="ssl">SSL/TLS (465)</option>
                  <option value="starttls">STARTTLS (587)</option>
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                {t.username}
                <Input value={form.smtpUsername} placeholder="noreply@yourdomain.com" onChange={(e) => update("smtpUsername", e.target.value)} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                {t.password}
                <Input type="password" value={smtpPassword} placeholder={form.hasSmtpPassword ? `Saved password ending ${form.smtpPasswordLast4 ?? ""}` : ""} onChange={(e) => setSmtpPassword(e.target.value)} />
                <span className="block text-xs font-normal text-muted-foreground">{t.passwordHint}</span>
              </label>
              <label className="space-y-2 text-sm font-medium">
                {t.fromName}
                <Input value={form.emailFromName} onChange={(e) => update("emailFromName", e.target.value)} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                {t.fromEmail}
                <Input type="email" value={form.emailFromAddress} placeholder="noreply@yourdomain.com" onChange={(e) => update("emailFromAddress", e.target.value)} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                {t.replyTo}
                <Input type="email" value={form.emailReplyTo} placeholder="support@yourdomain.com" onChange={(e) => update("emailReplyTo", e.target.value)} />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                {t.recipient}
                <Input type="email" value={form.emailTestRecipient} placeholder="omar@example.com" onChange={(e) => update("emailTestRecipient", e.target.value)} />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button type="button" variant="primary" onClick={save} loading={saving} style={{ display: "inline-flex" }}>
                <Save className="h-4 w-4" />
                {t.save}
              </Button>
              <Button type="button" variant="secondary" onClick={sendTest} loading={testing} style={{ display: "inline-flex" }}>
                <Send className="h-4 w-4" />
                {t.test}
              </Button>
              <Button type="button" variant="destructive" onClick={clearPassword} loading={clearing} style={{ display: "inline-flex" }}>
                <Trash2 className="h-4 w-4" />
                {t.clear}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {ready ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertTriangle className="h-5 w-5 text-warning" />}
                {t.status}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                {form.hasSmtpPassword ? t.configured : t.notConfigured}
              </p>
              {form.emailLastTestStatus && (
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="font-medium">{form.emailLastTestStatus === "success" ? t.lastPassed : t.lastFailed}</p>
                  <p className="mt-1 text-muted-foreground">{form.emailLastTestMessage}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.setup}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 ps-5 text-sm text-muted-foreground">
                {checklist.split("\n").map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
