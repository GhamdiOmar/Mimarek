import type { Metadata, Viewport } from "next";
import "@repo/ui/globals.css";
import { Tajawal } from 'next/font/google';
import localFont from 'next/font/local';
import { ThemeProvider } from "../components/ThemeProvider";
import { Toaster } from "@repo/ui";
import { ConsentProvider } from "../components/ConsentProvider";
import { AxeDevAudit } from "../components/AxeDevAudit";
import { db } from "@repo/db";
import { cache } from "react";
import { getLang } from "../lib/i18n";

// Mimarek brand typography: Tajawal (Arabic + UI default) + Satoshi (Latin, self-hosted)
const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
});

const satoshi = localFont({
  src: [{ path: './fonts/satoshi/Satoshi-Variable.woff2', weight: '300 900', style: 'normal' }],
  variable: '--font-satoshi',
  display: 'swap',
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#001B2A" },
  ],
};

// Deduplicates the DB read within a single request (shared by generateMetadata + RootLayout)
const getConfig = cache(async () => {
  return db.systemConfig.findUnique({ where: { id: "system" } }).catch(() => null);
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();

  const canonical = config?.canonicalUrl ?? "https://mimarek.sa";
  const ogImage = config?.ogImageUrl ?? "/og-image.png";

  return {
    metadataBase: new URL(canonical),
    title: {
      default: config?.siteTitle ?? "Mimarek | منصة إدارة العقارات السعودية",
      template: config?.siteTitleTemplate ?? "%s | Mimarek",
    },
    description: config?.siteDescriptionAr ?? "منصة PropTech السعودية لمطوري العقارات — لإدارة الوحدات والمبيعات والإيجارات والصيانة والتحصيل — متوافقة مع بلدي وزاتكا وإيجار.",
    alternates: {
      canonical: "/",
      languages: {
        "ar-SA": `${canonical}/ar`,
        en: `${canonical}/en`,
        "x-default": `${canonical}/ar`,
      },
    },
    openGraph: {
      type: (config?.ogType as "website" | "article") ?? "website",
      siteName: "Mimarek",
      locale: config?.ogLocale ?? "ar_SA",
      images: [{ url: ogImage, width: 1200, height: 630, alt: "Mimarek — Saudi PropTech Platform" }],
    },
    twitter: {
      card: (config?.twitterCard as "summary" | "summary_large_image") ?? "summary_large_image",
      site: config?.twitterHandle ?? undefined,
      images: [ogImage],
    },
    icons: {
      icon: config?.faviconUrl ?? "/favicon.ico",
      apple: config?.appleTouchIconUrl ?? "/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      title: "Mimarek",
      statusBarStyle: "default",
    },
    verification: {
      google: config?.gscVerificationCode ?? undefined,
      other: config?.bingVerificationCode
        ? { "msvalidate.01": [config.bingVerificationCode] }
        : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await getConfig();
  const lang = await getLang();
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <html lang={lang} dir={dir} className={`${tajawal.variable} ${satoshi.variable}`} suppressHydrationWarning>
      <body className="font-tajawal antialiased text-body">
        <ThemeProvider>
          <ConsentProvider
            initialLang={lang}
            gtmContainerId={config?.gtmContainerId}
            ga4MeasurementId={config?.ga4MeasurementId}
          >
            <AxeDevAudit />
            {children}
            <Toaster />
          </ConsentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
