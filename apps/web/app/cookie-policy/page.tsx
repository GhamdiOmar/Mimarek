import type { Metadata } from "next";
import { getLang } from "../../lib/i18n";

export const metadata: Metadata = {
  title: "Cookie Policy — Mimarek | سياسة ملفات تعريف الارتباط",
  description:
    "How Mimarek uses cookies, the categories we use, and how to manage or withdraw your consent under the Saudi PDPL.",
};

const t = (lang: "ar" | "en", ar: string, en: string) => (lang === "ar" ? ar : en);

export default async function CookiePolicyPage() {
  const lang = await getLang();
  const updated = "2026-06-12";

  const rows: Array<{ name: string; provider: string; purpose: string; category: string; duration: string }> =
    [
      {
        name: "mimaric-lang",
        provider: t(lang, "معمارك (طرف أول)", "Mimarek (first-party)"),
        purpose: t(lang, "تذكّر تفضيل اللغة", "Stores your language preference"),
        category: t(lang, "ضرورية", "Necessary"),
        duration: t(lang, "12 شهرًا", "12 months"),
      },
      {
        name: "mimaric-consent",
        provider: t(lang, "معمارك", "Mimarek"),
        purpose: t(lang, "تخزين اختياراتك لملفات تعريف الارتباط", "Stores your cookie choices"),
        category: t(lang, "ضرورية", "Necessary"),
        duration: t(lang, "12 شهرًا", "12 months"),
      },
      {
        name: t(lang, "جلسة الدخول (NextAuth)", "Session (NextAuth)"),
        provider: t(lang, "معمارك", "Mimarek"),
        purpose: t(lang, "إبقاؤك مسجّل الدخول", "Keeps you signed in"),
        category: t(lang, "ضرورية", "Necessary"),
        duration: t(lang, "الجلسة", "Session"),
      },
      {
        name: "_ga, _ga_*",
        provider: "Google",
        purpose: t(lang, "قياس الاستخدام والتحليلات", "Usage measurement & analytics"),
        category: t(lang, "تحليلات", "Analytics"),
        duration: t(lang, "حتى 24 شهرًا (بعد الموافقة فقط)", "Up to 24 months (only after consent)"),
      },
    ];

  const sections: Array<{ h: string; p: string }> = [
    {
      h: t(lang, "ما هي ملفات تعريف الارتباط؟", "What are cookies?"),
      p: t(
        lang,
        "ملفات تعريف الارتباط ملفات نصية صغيرة تُحفظ على جهازك لتمكين عمل المنصة وتذكّر تفضيلاتك.",
        "Cookies are small text files stored on your device to enable the platform to work and to remember your preferences.",
      ),
    },
    {
      h: t(lang, "كيف نستخدمها", "How Mimarek uses cookies"),
      p: t(
        lang,
        "نستخدم ملفات ضرورية لتشغيل المنصة، وملفات تحليلات اختيارية. لا تُفعّل التحليلات إلا بعد موافقتك الصريحة، وهي معطّلة افتراضيًا.",
        "We use necessary cookies to run the platform and optional analytics cookies. Analytics are off by default and load only after your explicit consent.",
      ),
    },
    {
      h: t(lang, "الأساس النظامي وحقوقك", "Legal basis & your rights (PDPL)"),
      p: t(
        lang,
        "نعتمد على موافقتك كأساس نظامي لملفات التحليلات وفق نظام حماية البيانات الشخصية. يحق لك سحب موافقتك في أي وقت بنفس سهولة منحها، وذلك عبر «إعدادات ملفات تعريف الارتباط». تشرف الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) على تطبيق النظام.",
        "We rely on your consent as the legal basis for analytics cookies under the Personal Data Protection Law (PDPL). You may withdraw consent at any time, as easily as you gave it, via “Cookie settings.” The Saudi Data & AI Authority (SDAIA) oversees the law.",
      ),
    },
    {
      h: t(lang, "كيفية الإدارة أو السحب", "How to manage or withdraw consent"),
      p: t(
        lang,
        "افتح «إعدادات ملفات تعريف الارتباط» من تذييل الصفحة في أي وقت لتغيير اختيارك. عند السحب يتوقف الجمع دون تأخير غير مبرّر. يمكنك أيضًا التحكم بملفات تعريف الارتباط عبر إعدادات المتصفح.",
        "Open “Cookie settings” from the page footer at any time to change your choice. On withdrawal, collection stops without undue delay. You can also control cookies via your browser settings.",
      ),
    },
    {
      h: t(lang, "الأطراف الثالثة ونقل البيانات", "Third parties & data transfer"),
      p: t(
        lang,
        "تُشغَّل التحليلات عبر Google Analytics، وهو معالِج بيانات خارج المملكة، ولا يُحمَّل إلا بعد موافقتك.",
        "Analytics are powered by Google Analytics, a processor located outside the Kingdom, loaded only after your consent.",
      ),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-h1 font-bold text-foreground">
        {t(lang, "سياسة ملفات تعريف الارتباط", "Cookie Policy")}
      </h1>
      <p className="mt-2 text-caption text-muted-foreground">
        {t(lang, "آخر تحديث:", "Last updated:")} <span dir="ltr">{updated}</span>
      </p>

      {sections.slice(0, 2).map((s) => (
        <section key={s.h} className="mt-8">
          <h2 className="text-h3 font-semibold text-foreground">{s.h}</h2>
          <p className="mt-2 text-body text-muted-foreground">{s.p}</p>
        </section>
      ))}

      <section className="mt-8">
        <h2 className="text-h3 font-semibold text-foreground">
          {t(lang, "قائمة ملفات تعريف الارتباط", "Cookie inventory")}
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-start text-caption">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-start font-semibold">{t(lang, "الاسم", "Name")}</th>
                <th className="p-3 text-start font-semibold">{t(lang, "المزوّد", "Provider")}</th>
                <th className="p-3 text-start font-semibold">{t(lang, "الغرض", "Purpose")}</th>
                <th className="p-3 text-start font-semibold">{t(lang, "الفئة", "Category")}</th>
                <th className="p-3 text-start font-semibold">{t(lang, "المدة", "Duration")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-border">
                  <td className="p-3 font-mono text-foreground" dir="ltr">{r.name}</td>
                  <td className="p-3 text-muted-foreground">{r.provider}</td>
                  <td className="p-3 text-muted-foreground">{r.purpose}</td>
                  <td className="p-3 text-muted-foreground">{r.category}</td>
                  <td className="p-3 text-muted-foreground">{r.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sections.slice(2).map((s) => (
        <section key={s.h} className="mt-8">
          <h2 className="text-h3 font-semibold text-foreground">{s.h}</h2>
          <p className="mt-2 text-body text-muted-foreground">{s.p}</p>
        </section>
      ))}
    </main>
  );
}
