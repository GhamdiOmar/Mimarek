import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale !== "en";

  return {
    title: isAr
      ? "ميماريك | منصة إدارة العقارات السعودية"
      : "Mimaric | Saudi PropTech Platform for Property Management",
    description: isAr
      ? "منصة PropTech السعودية لإدارة العقارات — المبيعات والإيجارات والصيانة متوافقة مع بلدي وزاتكا ورؤية 2030."
      : "The Saudi PropTech platform for property management — sales, rentals, and maintenance compliant with Balady, ZATCA, and Vision 2030.",
    alternates: {
      canonical: `https://mimaric.app/${locale}`,
      languages: {
        "ar-SA": "https://mimaric.app/ar",
        en: "https://mimaric.app/en",
        "x-default": "https://mimaric.app/ar",
      },
    },
    openGraph: {
      title: isAr
        ? "ميماريك | منصة إدارة العقارات السعودية"
        : "Mimaric | Saudi PropTech Platform",
      description: isAr
        ? "منصة PropTech السعودية — المبيعات والإيجارات والصيانة في مكان واحد."
        : "The Saudi PropTech platform — manage sales, rentals, and maintenance in one place.",
      locale: isAr ? "ar_SA" : "en_US",
      alternateLocale: isAr ? ["en_US"] : ["ar_SA"],
      type: "website",
      url: `https://mimaric.app/${locale}`,
    },
  };
}

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
