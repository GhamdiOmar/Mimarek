import LandingPage from "../landing/LandingPage";
import { getSeoConfigPublic } from "../actions/seo-config";

export function generateStaticParams() {
  return [{ locale: "ar" }, { locale: "en" }];
}

export default async function LocalizedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lang = locale === "en" ? "en" : "ar";
  const toggleLangHref = lang === "ar" ? "/en" : "/ar";
  const config = await getSeoConfigPublic();

  return (
    <LandingPage
      lang={lang}
      toggleLangHref={toggleLangHref}
      falLicense={config?.regaPlatformFalLicense}
    />
  );
}
