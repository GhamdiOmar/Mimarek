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
      nameArabic: "شركة معماري للتطوير العقاري",
      nameEnglish: "Mimaric Real Estate Development Co.",
      tradeNameArabic: "معماري",
      tradeNameEnglish: "Mimaric",
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
        email: "info@mimaric.sa",
        websiteUrl: "https://mimaric.sa",
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
        managerName: "عمر الغامدي",
        managerId: "1098765432",
        managerRole: "المدير العام",
      },
    },
    create: {
      name: "Mimaric Development",
      nameArabic: "شركة معماري للتطوير العقاري",
      nameEnglish: "Mimaric Real Estate Development Co.",
      tradeNameArabic: "معماري",
      tradeNameEnglish: "Mimaric",
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
        email: "info@mimaric.sa",
        websiteUrl: "https://mimaric.sa",
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
        managerName: "عمر الغامدي",
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
    where: { email: "admin@mimaric.sa" },
    update: { password: hashedPassword, role: "ADMIN", ...VERIFIED },
    create: {
      email: "admin@mimaric.sa",
      name: "Omar Al-Ghamdi",
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
    where: { email: "ahmed@mimaric.sa" },
    update: { ...VERIFIED },
    create: {
      email: "ahmed@mimaric.sa",
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
    where: { email: "fatima@mimaric.sa" },
    update: { ...VERIFIED },
    create: {
      email: "fatima@mimaric.sa",
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
    where: { email: "khalid@mimaric.sa" },
    update: { ...VERIFIED },
    create: {
      email: "khalid@mimaric.sa",
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
    where: { email: "dev_admin@mimaric.sa" },
    update: { role: "SYSTEM_SUPPORT", organizationId: null, ...VERIFIED },
    create: { email: "dev_admin@mimaric.sa", name: "Saeed Al-Anzi", password: testPassword, role: "SYSTEM_SUPPORT", organizationId: null, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "pm@mimaric.sa" },
    update: { ...VERIFIED },
    create: { email: "pm@mimaric.sa", name: "Nasser Al-Zahrani", password: testPassword, role: "MANAGER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "sales_mgr@mimaric.sa" },
    update: { ...VERIFIED },
    create: { email: "sales_mgr@mimaric.sa", name: "Huda Al-Maliki", password: testPassword, role: "MANAGER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "property_mgr@mimaric.sa" },
    update: { ...VERIFIED },
    create: { email: "property_mgr@mimaric.sa", name: "Maryam Al-Subaie", password: testPassword, role: "MANAGER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "buyer@mimaric.sa" },
    update: { ...VERIFIED },
    create: { email: "buyer@mimaric.sa", name: "Turki Al-Fadhli", password: testPassword, role: "USER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "tenant@mimaric.sa" },
    update: { ...VERIFIED },
    create: { email: "tenant@mimaric.sa", name: "Reem Al-Harthy", password: testPassword, role: "USER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "user@mimaric.sa" },
    update: { ...VERIFIED },
    create: { email: "user@mimaric.sa", name: "Lama Al-Jaber", password: testPassword, role: "USER", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  // Dedicated LEASING and FINANCE role users (for testing the v4.15.0 role permission sets)
  await prisma.user.upsert({
    where: { email: "leasing@mimaric.sa" },
    update: { role: "LEASING", organizationId: org.id, ...VERIFIED },
    create: { email: "leasing@mimaric.sa", name: "Sara Al-Dossari", password: testPassword, role: "LEASING", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  await prisma.user.upsert({
    where: { email: "finance@mimaric.sa" },
    update: { role: "FINANCE", organizationId: org.id, ...VERIFIED },
    create: { email: "finance@mimaric.sa", name: "Yousef Al-Qahtani", password: testPassword, role: "FINANCE", organizationId: org.id, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  // System Admin — Mimaric platform admin (for testing system-level ticket management)
  await prisma.user.upsert({
    where: { email: "system@mimaric.sa" },
    update: { role: "SYSTEM_ADMIN", organizationId: null, ...VERIFIED },
    create: { email: "system@mimaric.sa", name: "Mimaric System Admin", password: testPassword, role: "SYSTEM_ADMIN", organizationId: null, onboardingCompleted: true, accountType: "company", ...VERIFIED },
  });
  // System Support — Mimaric support/engineering team
  await prisma.user.upsert({
    where: { email: "support@mimaric.sa" },
    update: { role: "SYSTEM_SUPPORT", organizationId: null, ...VERIFIED },
    create: { email: "support@mimaric.sa", name: "Mimaric Support Agent", password: testPassword, role: "SYSTEM_SUPPORT", organizationId: null, onboardingCompleted: true, accountType: "company", ...VERIFIED },
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

  const starterEntitlements = [
    { featureKey: "users.max", type: "LIMIT", value: "5" },
    { featureKey: "units.max", type: "LIMIT", value: "50" },
    { featureKey: "cmms.access", type: "BOOLEAN", value: "false" },
    { featureKey: "reports.export", type: "BOOLEAN", value: "false" },
    { featureKey: "pii.encryption", type: "BOOLEAN", value: "false" },
    { featureKey: "audit.access", type: "BOOLEAN", value: "false" },
    { featureKey: "api.access", type: "BOOLEAN", value: "false" },
    { featureKey: "custom.branding", type: "BOOLEAN", value: "false" },
    { featureKey: "sla.priority", type: "LIMIT", value: "standard" },
  ];

  const professionalEntitlements = [
    { featureKey: "users.max", type: "LIMIT", value: "25" },
    { featureKey: "units.max", type: "LIMIT", value: "500" },
    { featureKey: "cmms.access", type: "BOOLEAN", value: "true" },
    { featureKey: "reports.export", type: "BOOLEAN", value: "true" },
    { featureKey: "pii.encryption", type: "BOOLEAN", value: "true" },
    { featureKey: "audit.access", type: "BOOLEAN", value: "true" },
    { featureKey: "api.access", type: "BOOLEAN", value: "false" },
    { featureKey: "custom.branding", type: "BOOLEAN", value: "false" },
    { featureKey: "sla.priority", type: "LIMIT", value: "business" },
  ];

  const enterpriseEntitlements = [
    { featureKey: "users.max", type: "LIMIT", value: "unlimited" },
    { featureKey: "units.max", type: "LIMIT", value: "unlimited" },
    { featureKey: "cmms.access", type: "BOOLEAN", value: "true" },
    { featureKey: "reports.export", type: "BOOLEAN", value: "true" },
    { featureKey: "pii.encryption", type: "BOOLEAN", value: "true" },
    { featureKey: "audit.access", type: "BOOLEAN", value: "true" },
    { featureKey: "api.access", type: "BOOLEAN", value: "true" },
    { featureKey: "custom.branding", type: "BOOLEAN", value: "true" },
    { featureKey: "sla.priority", type: "LIMIT", value: "premium" },
  ];

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

  // Subscription for Mimaric org (Professional, ACTIVE).
  // Idempotent: a prior test run may have mutated the seed subscription's status
  // (e.g. to PAST_DUE), which the old `findFirst(status in ACTIVE/TRIALING)` guard
  // would miss — then blindly create a SECOND active sub, drifting billing state
  // across runs. Find ANY sub for the org and normalize it back to the canonical
  // ACTIVE state; only create when none exists. Never duplicates.
  const mimaricSub = {
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
    await prisma.subscription.update({ where: { id: existingSub.id }, data: mimaricSub });
  } else {
    await prisma.subscription.create({ data: { organizationId: org.id, ...mimaricSub } });
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
