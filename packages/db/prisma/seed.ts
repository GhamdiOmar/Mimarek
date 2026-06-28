import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hash as bcryptHash } from "@node-rs/bcrypt";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not defined");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Organization (MOC-aligned)
  const org = await prisma.organization.upsert({
    where: { crNumber: "1010342981" },
    update: {
      nameArabic: "شركة معمارك للتطوير العقاري",
      nameEnglish: "Mimarek Real Estate Development Co.",
      tradeNameArabic: "معمارك",
      tradeNameEnglish: "Mimarek",
      entityType: "COMPANY",
      legalForm: "LIMITED_LIABILITY_COMPANY",
      registrationStatus: "ACTIVE_REG",
      registrationDate: new Date("2020-03-15"),
      expiryDate: new Date("2028-03-14"),
      capitalAmountSar: 5000000,
      mainActivityCode: "411001",
      mainActivityNameAr: "التطوير العقاري",
      contactInfo: {
        mobileNumber: "0551234567",
        phoneNumber: "0112345678",
        email: "info@mimarek.sa",
        websiteUrl: "https://mimarek.sa",
      },
      nationalAddress: {
        region: "منطقة الرياض",
        city: "الرياض",
        district: "العليا",
        streetName: "طريق الملك فهد",
        buildingNumber: "2345",
        postalCode: "12211",
        additionalNumber: "8765",
        shortAddress: "RRAA2345",
      },
      managerInfo: {
        managerName: "محمد العتيبي",
        managerId: "1098765432",
        managerRole: "المدير العام",
      },
    },
    create: {
      name: "Mimarek Development",
      nameArabic: "شركة معمارك للتطوير العقاري",
      nameEnglish: "Mimarek Real Estate Development Co.",
      tradeNameArabic: "معمارك",
      tradeNameEnglish: "Mimarek",
      crNumber: "1010342981",
      unifiedNumber: "7001234567",
      vatNumber: "310452938100003",
      type: "DEVELOPER",
      entityType: "COMPANY",
      legalForm: "LIMITED_LIABILITY_COMPANY",
      registrationStatus: "ACTIVE_REG",
      registrationDate: new Date("2020-03-15"),
      expiryDate: new Date("2028-03-14"),
      capitalAmountSar: 5000000,
      mainActivityCode: "411001",
      mainActivityNameAr: "التطوير العقاري",
      contactInfo: {
        mobileNumber: "0551234567",
        phoneNumber: "0112345678",
        email: "info@mimarek.sa",
        websiteUrl: "https://mimarek.sa",
      },
      nationalAddress: {
        region: "منطقة الرياض",
        city: "الرياض",
        district: "العليا",
        streetName: "طريق الملك فهد",
        buildingNumber: "2345",
        postalCode: "12211",
        additionalNumber: "8765",
        shortAddress: "RRAA2345",
      },
      managerInfo: {
        managerName: "محمد العتيبي",
        managerId: "1098765432",
        managerRole: "المدير العام",
      },
    },
  });
  console.log("Organization:", org.name);

  // Seeded accounts are pre-verified so re-seeding never locks out test logins
  // (email-verification-before-activation gates login on a non-null emailVerified).
  // Spread into BOTH the create and update path of every user upsert.
  const VERIFIED = { emailVerified: new Date() };

  // 2. Company Admin User (customer admin test account)
  const hashedPassword = await bcryptHash("mimaric2026", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@mimarek.sa" },
    update: { name: "Mohammed Al-Otaibi", password: hashedPassword, role: "ADMIN", ...VERIFIED },
    create: {
      email: "admin@mimarek.sa",
      name: "Mohammed Al-Otaibi",
      password: hashedPassword,
      role: "ADMIN",
      organizationId: org.id,
      onboardingCompleted: true,
      accountType: "company",
      ...VERIFIED,
    },
  });
  console.log("Company Admin user:", admin.email);

  // 3. Team members
  const salesPassword = await bcryptHash("sales2026", 12);
  const financePassword = await bcryptHash("finance2026", 12);

  await prisma.user.upsert({
    where: { email: "ahmed@mimarek.sa" },
    update: { ...VERIFIED },
    create: {
      email: "ahmed@mimarek.sa",
      name: "Ahmed Al-Harbi",
      password: salesPassword,
      role: "AGENT",
      organizationId: org.id,
      onboardingCompleted: true,
      accountType: "company",
      ...VERIFIED,
    },
  });

  await prisma.user.upsert({
    where: { email: "fatima@mimarek.sa" },
    update: { ...VERIFIED },
    create: {
      email: "fatima@mimarek.sa",
      name: "Fatima Al-Rashid",
      password: financePassword,
      role: "MANAGER",
      organizationId: org.id,
      onboardingCompleted: true,
      accountType: "company",
      ...VERIFIED,
    },
  });

  await prisma.user.upsert({
    where: { email: "khalid@mimarek.sa" },
    update: { ...VERIFIED },
    create: {
      email: "khalid@mimarek.sa",
      name: "Khalid Al-Otaibi",
      password: salesPassword,
      role: "TECHNICIAN",
      organizationId: org.id,
      onboardingCompleted: true,
      accountType: "company",
      ...VERIFIED,
    },
  });

  // 3b. Additional role users (one per role for access testing)
  const testPassword = await bcryptHash("mimaric2026", 12);

  await prisma.user.upsert({
    where: { email: "dev_admin@mimarek.sa" },
    update: { role: "SYSTEM_SUPPORT", organizationId: null, ...VERIFIED },
    create: { email: "dev_admin@mimarek.sa", name: "Saeed Al-Anzi", password: testPassword, role: "SYSTEM_SUPPORT", organizationId: null, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "pm@mimarek.sa" },
    update: { ...VERIFIED },
    create: { email: "pm@mimarek.sa", name: "Nasser Al-Zahrani", password: testPassword, role: "MANAGER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "sales_mgr@mimarek.sa" },
    update: { ...VERIFIED },
    create: { email: "sales_mgr@mimarek.sa", name: "Huda Al-Maliki", password: testPassword, role: "MANAGER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "property_mgr@mimarek.sa" },
    update: { ...VERIFIED },
    create: { email: "property_mgr@mimarek.sa", name: "Maryam Al-Subaie", password: testPassword, role: "MANAGER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "buyer@mimarek.sa" },
    update: { ...VERIFIED },
    create: { email: "buyer@mimarek.sa", name: "Turki Al-Fadhli", password: testPassword, role: "USER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "tenant@mimarek.sa" },
    update: { ...VERIFIED },
    create: { email: "tenant@mimarek.sa", name: "Reem Al-Harthy", password: testPassword, role: "USER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "user@mimarek.sa" },
    update: { ...VERIFIED },
    create: { email: "user@mimarek.sa", name: "Lama Al-Jaber", password: testPassword, role: "USER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  // Dedicated LEASING and FINANCE role users (for testing the v4.15.0 role permission sets)
  await prisma.user.upsert({
    where: { email: "leasing@mimarek.sa" },
    update: { role: "LEASING", organizationId: org.id, ...VERIFIED },
    create: { email: "leasing@mimarek.sa", name: "Sara Al-Dossari", password: testPassword, role: "LEASING", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "finance@mimarek.sa" },
    update: { role: "FINANCE", organizationId: org.id, ...VERIFIED },
    create: { email: "finance@mimarek.sa", name: "Yousef Al-Qahtani", password: testPassword, role: "FINANCE", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  // System Admin — Mimarek platform admin (for testing system-level ticket management)
  await prisma.user.upsert({
    where: { email: "system@mimarek.sa" },
    update: { role: "SYSTEM_ADMIN", organizationId: null, ...VERIFIED },
    create: { email: "system@mimarek.sa", name: "Mimarek System Admin", password: testPassword, role: "SYSTEM_ADMIN", organizationId: null, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  // System Support — Mimarek support/engineering team
  await prisma.user.upsert({
    where: { email: "support@mimarek.sa" },
    update: { role: "SYSTEM_SUPPORT", organizationId: null, ...VERIFIED },
    create: { email: "support@mimarek.sa", name: "Mimarek Support Agent", password: testPassword, role: "SYSTEM_SUPPORT", organizationId: null, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  console.log("Created 11 role test users (9 operational + 2 system)");


  // ═══════════════════════════════════════════════════════════════════════════
  // DUMMY ORG — Separate tenant for E2E testing & demo
  // ═══════════════════════════════════════════════════════════════════════════

  const dummyOrg = await prisma.organization.upsert({
    where: { crNumber: "2050678901" },
    update: {},
    create: {
      name: "Dummy Development Co.",
      nameArabic: "شركة التطوير التجريبية",
      nameEnglish: "Dummy Development Co.",
      tradeNameArabic: "تجريبية",
      tradeNameEnglish: "DummyCo",
      crNumber: "2050678901",
      unifiedNumber: "7009876543",
      vatNumber: "310987654300003",
      type: "DEVELOPER",
      entityType: "COMPANY",
      legalForm: "LIMITED_LIABILITY_COMPANY",
      registrationStatus: "ACTIVE_REG",
      registrationDate: new Date("2022-01-10"),
      expiryDate: new Date("2030-01-09"),
      capitalAmountSar: 2000000,
      mainActivityCode: "411001",
      mainActivityNameAr: "التطوير العقاري",
      contactInfo: { mobileNumber: "0559999888", email: "info@dummy.sa" },
      nationalAddress: { region: "منطقة الرياض", city: "الرياض", district: "الورود", postalCode: "12252" },
    },
  });
  console.log("Dummy Org:", dummyOrg.name);

  // Dummy Org users (4 roles)
  const dummyPw = await bcryptHash("mimaric2026", 12);

  await prisma.user.upsert({
    where: { email: "dummy@demo.sa" },
    update: { password: dummyPw, role: "ADMIN", organizationId: dummyOrg.id, ...VERIFIED },
    create: { email: "dummy@demo.sa", name: "Dummy Admin", password: dummyPw, role: "ADMIN", organizationId: dummyOrg.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "pm@demo.sa" },
    update: { password: dummyPw, role: "MANAGER", organizationId: dummyOrg.id, ...VERIFIED },
    create: { email: "pm@demo.sa", name: "Sara Al-Qahtani", password: dummyPw, role: "MANAGER", organizationId: dummyOrg.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "sales@demo.sa" },
    update: { password: dummyPw, role: "AGENT", organizationId: dummyOrg.id, ...VERIFIED },
    create: { email: "sales@demo.sa", name: "Khalid Al-Dosari", password: dummyPw, role: "AGENT", organizationId: dummyOrg.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "tech@demo.sa" },
    update: { password: dummyPw, role: "TECHNICIAN", organizationId: dummyOrg.id, ...VERIFIED },
    create: { email: "tech@demo.sa", name: "Fahad Al-Mutairi", password: dummyPw, role: "TECHNICIAN", organizationId: dummyOrg.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  console.log("Created 4 Dummy Org users");


  // ═══════════════════════════════════════════════════════════════════════════
  // BILLING — Plans, Entitlements & Subscriptions
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("Creating plans & subscriptions...");

  // Helper: upsert plan and ensure entitlements always exist
  async function upsertPlanWithEntitlements(
    slug: string,
    planData: Record<string, unknown>,
    entitlements: { featureKey: string; type: string; value: string }[],
  ) {
    const plan = await prisma.plan.upsert({
      where: { slug },
      create: { slug, ...planData } as any,
      update: planData as any,
    });
    // Delete + recreate entitlements to ensure they're always correct
    await prisma.planEntitlement.deleteMany({ where: { planId: plan.id } });
    for (const ent of entitlements) {
      await prisma.planEntitlement.create({ data: { planId: plan.id, ...ent } });
    }
    return plan;
  }

  // ── Entitlement matrix — single source of truth across all 3 plans ──────────
  // resolveEntitlement() DENIES any featureKey absent from a plan (a missing
  // BOOLEAN silently locks a feature; a missing LIMIT blocks even the first
  // create). Driving all three plans from ONE matrix guarantees identical key
  // coverage — never hand-maintain three drifting lists. Columns: [Starter,
  // Professional, Enterprise]. Tiering follows the product spec: small operators
  // get the core CRM→reservations→contracts→payments→reports loop; Professional
  // adds finance/CMMS/marketplace-browse/ZATCA-sandbox/audit/export; Enterprise
  // unlocks publishing, production ZATCA, API, custom templates/branding.
  const ENTITLEMENT_MATRIX: {
    featureKey: string;
    type: "BOOLEAN" | "LIMIT";
    values: [string, string, string];
  }[] = [
    // Absolute-count limits
    { featureKey: "users.max",                  type: "LIMIT",   values: ["5", "25", "unlimited"] },
    { featureKey: "units.max",                  type: "LIMIT",   values: ["50", "500", "unlimited"] },
    { featureKey: "customers.max",              type: "LIMIT",   values: ["200", "2000", "unlimited"] },
    { featureKey: "marketplace.listings.max",   type: "LIMIT",   values: ["0", "20", "unlimited"] },
    { featureKey: "storage.gb.max",             type: "LIMIT",   values: ["5", "50", "unlimited"] },
    // Module access flags
    { featureKey: "crm.access",                 type: "BOOLEAN", values: ["true", "true", "true"] },
    { featureKey: "reservations.access",        type: "BOOLEAN", values: ["true", "true", "true"] },
    { featureKey: "contracts.access",           type: "BOOLEAN", values: ["true", "true", "true"] },
    { featureKey: "payments.access",            type: "BOOLEAN", values: ["true", "true", "true"] },
    { featureKey: "reports.access",             type: "BOOLEAN", values: ["true", "true", "true"] },
    { featureKey: "finance.access",             type: "BOOLEAN", values: ["false", "true", "true"] },
    { featureKey: "cmms.access",                type: "BOOLEAN", values: ["false", "true", "true"] },
    { featureKey: "marketplace.read.access",    type: "BOOLEAN", values: ["false", "true", "true"] },
    { featureKey: "marketplace.publish.access", type: "BOOLEAN", values: ["false", "false", "true"] },
    { featureKey: "zatca.sandbox.access",       type: "BOOLEAN", values: ["false", "true", "true"] },
    { featureKey: "zatca.production.access",    type: "BOOLEAN", values: ["false", "false", "true"] },
    { featureKey: "audit.access",               type: "BOOLEAN", values: ["false", "true", "true"] },
    { featureKey: "reports.export",             type: "BOOLEAN", values: ["false", "true", "true"] },
    { featureKey: "pii.encryption",             type: "BOOLEAN", values: ["false", "true", "true"] },
    { featureKey: "planning.access",            type: "BOOLEAN", values: ["false", "false", "true"] },
    { featureKey: "gis.access",                 type: "BOOLEAN", values: ["false", "false", "true"] },
    { featureKey: "api.access",                 type: "BOOLEAN", values: ["false", "false", "true"] },
    { featureKey: "custom.branding",            type: "BOOLEAN", values: ["false", "false", "true"] },
    { featureKey: "custom.templates.access",    type: "BOOLEAN", values: ["false", "false", "true"] },
    // Tier
    { featureKey: "sla.priority",               type: "LIMIT",   values: ["standard", "business", "premium"] },
  ];
  const entitlementsForPlan = (col: 0 | 1 | 2) =>
    ENTITLEMENT_MATRIX.map((e) => ({ featureKey: e.featureKey, type: e.type, value: e.values[col] }));

  const starterEntitlements = entitlementsForPlan(0);
  const professionalEntitlements = entitlementsForPlan(1);
  const enterpriseEntitlements = entitlementsForPlan(2);

  const starterPlan = await upsertPlanWithEntitlements("starter", {
    nameEn: "Starter", nameAr: "المبتدئ",
    descriptionEn: "Perfect for small property managers", descriptionAr: "مثالي لمديري العقارات الصغار",
    priceMonthly: 0, priceAnnual: 0, trialDays: 0, isPublic: true, isDefault: true, sortOrder: 0,
  }, starterEntitlements);

  const professionalPlan = await upsertPlanWithEntitlements("professional", {
    nameEn: "Professional", nameAr: "الاحترافي",
    descriptionEn: "For growing property management companies", descriptionAr: "لشركات إدارة العقارات المتنامية",
    priceMonthly: 499, priceAnnual: 4790, trialDays: 14, isPublic: true, isDefault: false, sortOrder: 1,
  }, professionalEntitlements);

  await upsertPlanWithEntitlements("enterprise", {
    nameEn: "Enterprise", nameAr: "المؤسسات",
    descriptionEn: "Full platform access with premium support", descriptionAr: "وصول كامل للمنصة مع دعم متميز",
    priceMonthly: 1499, priceAnnual: 14390, trialDays: 14, isPublic: true, isDefault: false, sortOrder: 2,
  }, enterpriseEntitlements);

  // Subscription for Mimarek org (Professional, ACTIVE).
  // Idempotent: a prior test run may have mutated the seed subscription's status
  // (e.g. to PAST_DUE), which the old `findFirst(status in ACTIVE/TRIALING)` guard
  // would miss — then blindly create a SECOND active sub, drifting billing state
  // across runs. Find ANY sub for the org and normalize it back to the canonical
  // ACTIVE state; only create when none exists. Never duplicates.
  const mimarekSub = {
    planId: professionalPlan.id,
    status: "ACTIVE" as const,
    billingCycle: "ANNUAL" as const,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    priceAtRenewal: 4790,
  };
  const existingSub = await prisma.subscription.findFirst({
    where: { organizationId: org.id },
  });
  if (existingSub) {
    await prisma.subscription.update({ where: { id: existingSub.id }, data: mimarekSub });
  } else {
    await prisma.subscription.create({ data: { organizationId: org.id, ...mimarekSub } });
  }

  // Subscription for Dummy org (Starter, ACTIVE) — idempotent, same rationale as above.
  const dummySub = {
    planId: starterPlan.id,
    status: "ACTIVE" as const,
    billingCycle: "ANNUAL" as const,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    priceAtRenewal: 0,
  };
  const existingDummySub = await prisma.subscription.findFirst({
    where: { organizationId: dummyOrg.id },
  });
  if (existingDummySub) {
    await prisma.subscription.update({ where: { id: existingDummySub.id }, data: dummySub });
  } else {
    await prisma.subscription.create({ data: { organizationId: dummyOrg.id, ...dummySub } });
  }

  console.log("Created plans (Starter, Professional, Enterprise) & subscriptions");

  // ── Marketplace (P3 conveyance) ─────────────────────────────────────────────
  // NOTE: this seed intentionally creates NO marketplaceListing rows. As of the P3
  // conveyance gate, a seller can no longer self-publish — submitting a listing
  // lands it in PENDING_REVIEW (complianceStatus PENDING_REVIEW), and only platform
  // moderation (moderateApproveListing) flips it to PUBLISHED + complianceStatus
  // APPROVED so buyers can see it. The cross-org reserve-and-buy rail additionally
  // requires the marketplaceConveyanceEnabled flag (SystemConfig), a VERIFIED
  // OrgRegaAuthorization for BOTH orgs, and a VERIFIED MarketplaceDeedProof.
  //
  // If you ever seed demo marketplace content, create the listings as
  //   { status: "PUBLISHED", complianceStatus: "APPROVED", publishedAt: new Date() }
  // (otherwise the demo marketplace is empty behind the moderation gate), and seed
  // a SELF_ASSERTED OrgRegaAuthorization for the test org so the admin REGA-
  // verification queue (/dashboard/admin/marketplace → REGA tab) has content.

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
