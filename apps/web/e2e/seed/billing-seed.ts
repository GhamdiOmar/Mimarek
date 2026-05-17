/**
 * Billing Test Data Seed Script
 *
 * Seeds the database with test plans, coupons, subscriptions, invoices,
 * and payment methods for E2E testing of the commercialization module.
 *
 * Usage:
 *   npx tsx e2e/seed/billing-seed.ts
 *
 * Prerequisites:
 *   - DATABASE_URL set in environment
 *   - Prisma client generated (`turbo run db:generate`)
 *   - At least one Organization exists (from auth setup or prior seeding)
 */

import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding billing test data...\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Plans & Entitlements
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("📋 Creating plans...");

  const starterPlan = await prisma.plan.upsert({
    where: { slug: "starter" },
    create: {
      slug: "starter",
      nameEn: "Starter",
      nameAr: "المبتدئ",
      descriptionEn: "Perfect for small property managers",
      descriptionAr: "مثالي لمديري العقارات الصغار",
      priceMonthly: 0,
      priceAnnual: 0,
      trialDays: 0,
      isPublic: true,
      isDefault: true,
      sortOrder: 0,
      entitlements: {
        create: [
          { featureKey: "users.max", type: "LIMIT", value: "5" },
          { featureKey: "units.max", type: "LIMIT", value: "50" },
          { featureKey: "cmms.access", type: "BOOLEAN", value: "false" },
          { featureKey: "reports.export", type: "BOOLEAN", value: "false" },
          { featureKey: "pii.encryption", type: "BOOLEAN", value: "false" },
          { featureKey: "audit.access", type: "BOOLEAN", value: "false" },
          { featureKey: "api.access", type: "BOOLEAN", value: "false" },
          { featureKey: "custom.branding", type: "BOOLEAN", value: "false" },
          { featureKey: "sla.priority", type: "LIMIT", value: "standard" },
        ],
      },
    },
    update: {
      nameEn: "Starter",
      nameAr: "المبتدئ",
      priceMonthly: 0,
      priceAnnual: 0,
    },
  });

  const professionalPlan = await prisma.plan.upsert({
    where: { slug: "professional" },
    create: {
      slug: "professional",
      nameEn: "Professional",
      nameAr: "الاحترافي",
      descriptionEn: "For growing property management companies",
      descriptionAr: "لشركات إدارة العقارات المتنامية",
      priceMonthly: 499,
      priceAnnual: 4790,
      trialDays: 14,
      isPublic: true,
      isDefault: false,
      sortOrder: 1,
      entitlements: {
        create: [
          { featureKey: "users.max", type: "LIMIT", value: "25" },
          { featureKey: "units.max", type: "LIMIT", value: "500" },
          { featureKey: "cmms.access", type: "BOOLEAN", value: "true" },
          { featureKey: "reports.export", type: "BOOLEAN", value: "true" },
          { featureKey: "pii.encryption", type: "BOOLEAN", value: "true" },
          { featureKey: "audit.access", type: "BOOLEAN", value: "true" },
          { featureKey: "api.access", type: "BOOLEAN", value: "false" },
          { featureKey: "custom.branding", type: "BOOLEAN", value: "false" },
          { featureKey: "sla.priority", type: "LIMIT", value: "business" },
        ],
      },
    },
    update: {
      nameEn: "Professional",
      nameAr: "الاحترافي",
      priceMonthly: 499,
      priceAnnual: 4790,
    },
  });

  const enterprisePlan = await prisma.plan.upsert({
    where: { slug: "enterprise" },
    create: {
      slug: "enterprise",
      nameEn: "Enterprise",
      nameAr: "المؤسسات",
      descriptionEn: "Full platform access with premium support",
      descriptionAr: "وصول كامل للمنصة مع دعم متميز",
      priceMonthly: 1499,
      priceAnnual: 14390,
      trialDays: 14,
      isPublic: true,
      isDefault: false,
      sortOrder: 2,
      entitlements: {
        create: [
          { featureKey: "users.max", type: "LIMIT", value: "unlimited" },
          { featureKey: "units.max", type: "LIMIT", value: "unlimited" },
          { featureKey: "cmms.access", type: "BOOLEAN", value: "true" },
          { featureKey: "reports.export", type: "BOOLEAN", value: "true" },
          { featureKey: "pii.encryption", type: "BOOLEAN", value: "true" },
          { featureKey: "audit.access", type: "BOOLEAN", value: "true" },
          { featureKey: "api.access", type: "BOOLEAN", value: "true" },
          { featureKey: "custom.branding", type: "BOOLEAN", value: "true" },
          { featureKey: "sla.priority", type: "LIMIT", value: "premium" },
        ],
      },
    },
    update: {
      nameEn: "Enterprise",
      nameAr: "المؤسسات",
      priceMonthly: 1499,
      priceAnnual: 14390,
    },
  });

  console.log(`  ✅ Starter: ${starterPlan.id}`);
  console.log(`  ✅ Professional: ${professionalPlan.id}`);
  console.log(`  ✅ Enterprise: ${enterprisePlan.id}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Coupons
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n🏷️  Creating coupons...");

  const welcome20 = await prisma.coupon.upsert({
    where: { code: "WELCOME20" },
    create: {
      code: "WELCOME20",
      descriptionEn: "20% off your first subscription",
      descriptionAr: "خصم 20% على أول اشتراك",
      type: "PERCENTAGE",
      value: 20,
      maxRedemptions: 100,
      validFrom: new Date("2025-01-01"),
      validUntil: new Date("2027-12-31"),
      isActive: true,
    },
    update: { isActive: true },
  });

  const fixed100 = await prisma.coupon.upsert({
    where: { code: "SAVE100" },
    create: {
      code: "SAVE100",
      descriptionEn: "100 SAR off any plan",
      descriptionAr: "خصم 100 ر.س على أي خطة",
      type: "FIXED_AMOUNT",
      value: 100,
      maxRedemptions: 50,
      validFrom: new Date("2025-01-01"),
      validUntil: new Date("2027-12-31"),
      isActive: true,
    },
    update: { isActive: true },
  });

  const expiredCoupon = await prisma.coupon.upsert({
    where: { code: "EXPIRED2024" },
    create: {
      code: "EXPIRED2024",
      descriptionEn: "Expired coupon for testing",
      descriptionAr: "كوبون منتهي للاختبار",
      type: "PERCENTAGE",
      value: 50,
      validFrom: new Date("2024-01-01"),
      validUntil: new Date("2024-12-31"), // Expired
      isActive: true,
    },
    update: {},
  });

  const inactiveCoupon = await prisma.coupon.upsert({
    where: { code: "INACTIVE50" },
    create: {
      code: "INACTIVE50",
      descriptionEn: "Deactivated coupon",
      descriptionAr: "كوبون معطل",
      type: "PERCENTAGE",
      value: 50,
      validFrom: new Date("2025-01-01"),
      isActive: false, // Inactive
    },
    update: { isActive: false },
  });

  const maxedOutCoupon = await prisma.coupon.upsert({
    where: { code: "MAXED" },
    create: {
      code: "MAXED",
      descriptionEn: "Max redemptions reached",
      descriptionAr: "وصل الحد الأقصى للاستخدام",
      type: "PERCENTAGE",
      value: 10,
      maxRedemptions: 1,
      currentUses: 1, // Already maxed
      validFrom: new Date("2025-01-01"),
      isActive: true,
    },
    update: { currentUses: 1 },
  });

  // Plan-specific coupon (only for Professional)
  const proPlanCoupon = await prisma.coupon.upsert({
    where: { code: "PROONLY30" },
    create: {
      code: "PROONLY30",
      descriptionEn: "30% off Professional plan only",
      descriptionAr: "خصم 30% على الخطة الاحترافية فقط",
      type: "PERCENTAGE",
      value: 30,
      validFrom: new Date("2025-01-01"),
      validUntil: new Date("2027-12-31"),
      isActive: true,
      plans: { connect: [{ id: professionalPlan.id }] },
    },
    update: {},
  });

  console.log(`  ✅ WELCOME20 (20% off): ${welcome20.id}`);
  console.log(`  ✅ SAVE100 (100 SAR off): ${fixed100.id}`);
  console.log(`  ✅ EXPIRED2024 (expired): ${expiredCoupon.id}`);
  console.log(`  ✅ INACTIVE50 (inactive): ${inactiveCoupon.id}`);
  console.log(`  ✅ MAXED (maxed out): ${maxedOutCoupon.id}`);
  console.log(`  ✅ PROONLY30 (pro-only): ${proPlanCoupon.id}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Get Test Organization
  // ═══════════════════════════════════════════════════════════════════════════

  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!org) {
    console.log("\n⚠️  No organization found. Skipping subscription, invoice, and payment method seeding.");
    console.log("   Run the app and create an org first, then re-run this seed.\n");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n🏢 Using organization: ${org.name} (${org.id})`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Subscription (TRIALING on Professional)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n📦 Creating test subscription...");

  // Clean up existing test subscriptions
  await prisma.subscriptionEvent.deleteMany({
    where: { subscription: { organizationId: org.id } },
  });
  await prisma.subscription.deleteMany({
    where: { organizationId: org.id },
  });

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const subscription = await prisma.subscription.create({
    data: {
      organizationId: org.id,
      planId: professionalPlan.id,
      status: "TRIALING",
      billingCycle: "ANNUAL",
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialEndsAt: trialEnd,
      nextBillingDate: trialEnd,
      priceAtRenewal: professionalPlan.priceAnnual,
    },
  });

  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId: subscription.id,
      fromStatus: null,
      toStatus: "TRIALING",
      triggeredBy: "system",
      reason: "New 14-day trial started for plan: professional",
    },
  });

  console.log(`  ✅ Subscription: ${subscription.id} (TRIALING, Professional, Annual)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Test Invoices
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n🧾 Creating test invoices...");

  // Invoice 1: PAID
  const inv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-2026-00001",
      organizationId: org.id,
      subscriptionId: subscription.id,
      status: "PAID",
      billingCycle: "ANNUAL",
      subtotal: 4790,
      vatRate: 0.15,
      vatAmount: 718.5,
      total: 5508.5,
      currency: "SAR",
      issuedAt: new Date("2026-01-15"),
      dueDate: new Date("2026-01-22"),
      paidAt: new Date("2026-01-16"),
      lineItems: {
        create: [{
          description: "Professional - Annual subscription",
          descriptionAr: "الاحترافي - اشتراك سنوي",
          quantity: 1,
          unitPrice: 4790,
          vatRate: 0.15,
          vatAmount: 718.5,
          total: 5508.5,
          sortOrder: 0,
        }],
      },
    },
  });

  // Invoice 2: ISSUED (pending payment)
  const inv2 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-2026-00002",
      organizationId: org.id,
      subscriptionId: subscription.id,
      status: "ISSUED",
      billingCycle: "ANNUAL",
      subtotal: 4790,
      vatRate: 0.15,
      vatAmount: 718.5,
      total: 5508.5,
      currency: "SAR",
      issuedAt: new Date("2026-03-01"),
      dueDate: new Date("2026-03-08"),
      lineItems: {
        create: [{
          description: "Professional - Annual renewal",
          descriptionAr: "الاحترافي - تجديد سنوي",
          quantity: 1,
          unitPrice: 4790,
          vatRate: 0.15,
          vatAmount: 718.5,
          total: 5508.5,
          sortOrder: 0,
        }],
      },
    },
  });

  // Invoice 3: OVERDUE
  const inv3 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-2026-00003",
      organizationId: org.id,
      subscriptionId: subscription.id,
      status: "OVERDUE",
      billingCycle: "MONTHLY",
      subtotal: 499,
      vatRate: 0.15,
      vatAmount: 74.85,
      total: 573.85,
      currency: "SAR",
      issuedAt: new Date("2026-02-01"),
      dueDate: new Date("2026-02-08"),
      lineItems: {
        create: [{
          description: "Professional - Monthly subscription",
          descriptionAr: "الاحترافي - اشتراك شهري",
          quantity: 1,
          unitPrice: 499,
          vatRate: 0.15,
          vatAmount: 74.85,
          total: 573.85,
          sortOrder: 0,
        }],
      },
    },
  });

  console.log(`  ✅ INV-2026-00001 (PAID): ${inv1.id}`);
  console.log(`  ✅ INV-2026-00002 (ISSUED): ${inv2.id}`);
  console.log(`  ✅ INV-2026-00003 (OVERDUE): ${inv3.id}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Test Payment Method
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n💳 Creating test payment method...");

  await prisma.paymentMethod.deleteMany({
    where: { organizationId: org.id },
  });

  const paymentMethod = await prisma.paymentMethod.create({
    data: {
      organizationId: org.id,
      gateway: "moyasar",
      tokenId: "test_token_mada_4321",
      brand: "mada",
      lastFourDigits: "4321",
      expiryMonth: 12,
      expiryYear: 2028,
      holderName: "Test User",
      isDefault: true,
    },
  });

  console.log(`  ✅ Mada ****4321: ${paymentMethod.id}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Gateway Config
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n⚙️  Creating gateway config...");

  await prisma.gatewayConfig.upsert({
    where: { gateway: "moyasar" },
    create: {
      gateway: "moyasar",
      isEnabled: true,
      isPrimary: true,
      displayName: "Moyasar",
    },
    update: { isEnabled: true, isPrimary: true },
  });

  console.log("  ✅ Moyasar gateway configured");

  // ═══════════════════════════════════════════════════════════════════════════
  // Done
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n✨ Billing seed complete!\n");
  console.log("Test Data Summary:");
  console.log("─────────────────────────────────────────");
  console.log(`Plans:          3 (Starter, Professional, Enterprise)`);
  console.log(`Coupons:        6 (WELCOME20, SAVE100, EXPIRED2024, INACTIVE50, MAXED, PROONLY30)`);
  console.log(`Subscription:   1 (TRIALING, Professional, Annual)`);
  console.log(`Invoices:       3 (PAID, ISSUED, OVERDUE)`);
  console.log(`Payment Method: 1 (Mada ****4321)`);
  console.log(`Gateway:        1 (Moyasar, primary)`);
  console.log("─────────────────────────────────────────\n");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Seed failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
