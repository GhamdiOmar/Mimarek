import Header from "./components/Header";
import Hero from "./components/Hero";
import LogoBar from "./components/LogoBar";
import Features from "./components/Features";
import Vision2030 from "./components/Vision2030";
import HowItWorks from "./components/HowItWorks";
import Stats from "./components/Stats";
import Pricing from "./components/Pricing";
import FAQ from "./components/FAQ";
import FinalCTA from "./components/FinalCTA";
import Footer from "./components/Footer";
import SchemaMarkup from "./components/SchemaMarkup";

export default function LandingPage({
  lang,
  onToggleLang,
  toggleLangHref,
}: {
  lang: "ar" | "en";
  onToggleLang?: () => void;
  toggleLangHref?: string;
}) {
  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
      className="min-h-screen overflow-x-hidden"
    >
      <SchemaMarkup lang={lang} />
      <Header lang={lang} />
      <main id="main-content">
        <Hero lang={lang} />
        <LogoBar lang={lang} />
        <Features lang={lang} />
        <Vision2030 lang={lang} />
        <HowItWorks lang={lang} />
        <Stats lang={lang} />
        <Pricing lang={lang} />
        <FAQ lang={lang} />
        <FinalCTA lang={lang} />
      </main>
      <Footer lang={lang} onToggleLang={onToggleLang} toggleLangHref={toggleLangHref} />
    </div>
  );
}
