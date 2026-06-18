import { db } from "@repo/db";

// JSON-LD schema markup for SEO — uses dangerouslySetInnerHTML which is safe here because:
// 1. All content is server-generated from admin-controlled DB fields only
// 2. JSON.stringify() escapes all HTML special characters before injection
// 3. No user-facing input reaches this component
// See: https://nextjs.org/docs/app/building-your-application/optimizing/metadata#json-ld

const faqs = [
  {
    q: "ما هو ميماريك؟",
    a: "ميماريك هو منصة سعودية متكاملة لإدارة العقارات والمرافق. يغطي المبيعات وإدارة العملاء، الإيجارات، الصيانة، والفوترة — كل ذلك في منصة واحدة متوافقة مع الأنظمة السعودية.",
  },
  {
    q: "هل يوجد اشتراك مجاني؟",
    a: "نعم! خطة المبتدئ مجانية بالكامل وتشمل حتى 5 مستخدمين و50 وحدة. يمكنك الترقية في أي وقت.",
  },
  {
    q: "كيف تعمل التجربة المجانية لمدة 14 يوم؟",
    a: "عند الاشتراك في الخطة الاحترافية أو المؤسسات، تحصل على 14 يوم تجربة مجانية كاملة. لا يُطلب منك إدخال بيانات الدفع حتى انتهاء التجربة.",
  },
  {
    q: "ما طرق الدفع المتاحة؟",
    a: "ندعم مدى، فيزا، ماستركارد، و Apple Pay. جميع المعاملات مؤمنة وتتم بالريال السعودي.",
  },
  {
    q: "هل بياناتي آمنة؟",
    a: "نعم. نستخدم تشفير البيانات الشخصية (PII) في الخطط المدفوعة، مع استضافة سحابية آمنة وسجل مراجعة كامل لجميع العمليات.",
  },
  {
    q: "هل ميماريك متوافق مع الأنظمة السعودية؟",
    a: "نعم. ميماريك متوافق مع أنظمة بلدي، وزارة التجارة، وهيئة الزكاة والضريبة والجمارك (ZATCA).",
  },
];

function JsonLd({ data }: { data: object }) {
  // Safe: JSON.stringify escapes <, >, &, and " — no XSS possible
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

export default async function SchemaMarkup({ lang }: { lang: "ar" | "en" }) {
  const config = await db.systemConfig.findUnique({ where: { id: "system" } }).catch(() => null);

  const orgName = config?.schemaOrgName ?? "Mimaric";
  const logoUrl = config?.schemaOrgLogoUrl ?? "https://mimaric.app/assets/brand/Mimaric_Official_Logo_transparent.png";
  const canonicalBase = config?.canonicalUrl ?? "https://mimaric.app";

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: orgName,
    url: canonicalBase,
    logo: logoUrl,
    sameAs: [
      config?.schemaOrgTwitter,
      config?.schemaOrgLinkedIn,
      config?.schemaOrgInstagram,
    ].filter(Boolean),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["Arabic", "English"],
    },
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: orgName,
    url: canonicalBase,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${canonicalBase}/?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: orgName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: ["ar-SA", "en"],
    offers: {
      "@type": "Offer",
      priceCurrency: "SAR",
      price: "0",
      description: lang === "ar" ? "خطة مجانية متاحة" : "Free plan available",
    },
    description:
      lang === "ar"
        ? "منصة سعودية متكاملة لإدارة العقارات والمرافق متوافقة مع بلدي وزاتكا"
        : "Saudi PropTech platform for property management — compliant with Balady and ZATCA",
    url: canonicalBase,
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqSchema} />
    </>
  );
}
