import type { Metadata, Viewport } from "next";
import "@repo/ui/globals.css";
import { IBM_Plex_Sans_Arabic, DM_Sans } from 'next/font/google';
import { ThemeProvider } from "../components/ThemeProvider";
import { Toaster } from "@repo/ui";
import { AnalyticsProvider } from "../components/AnalyticsProvider";
import { AxeDevAudit } from "../components/AxeDevAudit";
import { db } from "@repo/db";
import { cache } from "react";

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-arabic',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Deduplicates the DB read within a single request (shared by generateMetadata + RootLayout)
const getConfig = cache(async () => {
  return db.systemConfig.findUnique({ where: { id: "system" } }).catch(() => null);
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();

  const canonical = config?.canonicalUrl ?? "https://mimaric.app";
  const ogImage = config?.ogImageUrl ?? "/og-image.png";

  return {
    metadataBase: new URL(canonical),
    title: {
      default: config?.siteTitle ?? "Mimaric | منصة إدارة العقارات السعودية",
      template: config?.siteTitleTemplate ?? "%s | Mimaric",
    },
    description: config?.siteDescriptionAr ?? "منصة PropTech السعودية لمطوري العقارات — إدارة المشاريع والمبيعات والإيجارات متوافقة مع بلدي وزاتكا ووافي.",
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
      siteName: "Mimaric",
      locale: config?.ogLocale ?? "ar_SA",
      images: [{ url: ogImage, width: 1200, height: 630, alt: "Mimaric — Saudi PropTech Platform" }],
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
      title: "Mimaric",
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

  return (
    <html lang="ar" dir="rtl" className={`${ibmPlexArabic.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body className="font-ibm-plex-arabic antialiased text-body">
        <ThemeProvider>
          <AxeDevAudit />
          {children}
          <Toaster />
        </ThemeProvider>
        <AnalyticsProvider
          gtmContainerId={config?.gtmContainerId}
          ga4MeasurementId={config?.ga4MeasurementId}
        />
      </body>
    </html>
  );
}
