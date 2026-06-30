/**
 * Billing & Subscription Notification Templates
 *
 * Notification types used by the commercialization layer:
 * - TRIAL_ENDING         — 3 days before trial expiry
 * - TRIAL_EXPIRED        — Trial ended without payment
 * - PAYMENT_SUCCEEDED    — Subscription payment cleared
 * - PAYMENT_FAILED       — Payment attempt failed
 * - SUBSCRIPTION_PAST_DUE — Grace period started
 * - SUBSCRIPTION_CANCELED — Subscription canceled
 * - INVOICE_ISSUED       — New invoice generated
 * - USAGE_LIMIT_80       — 80% of a limit reached
 * - USAGE_LIMIT_100      — Limit reached, action blocked
 * - PLAN_UPGRADED        — Plan change confirmed
 * - PLAN_DOWNGRADED      — Downgrade scheduled
 */

import { notifyAdmins } from "./create-notification";
import { db } from "@repo/db";
import { sendTransactionalEmail } from "./email";
import { scheduledPlanChangeEmail } from "./email-templates";

export async function notifyTrialEnding(orgId: string, daysLeft: number) {
  await notifyAdmins({
    type: "TRIAL_ENDING",
    title: `تنتهي الفترة التجريبية خلال ${daysLeft} أيام`,
    titleEn: `Trial expires in ${daysLeft} days`,
    message: "يرجى اختيار خطة للاستمرار بالخدمة دون انقطاع.",
    messageEn: "Please select a plan to continue without service interruption.",
    link: "/dashboard/billing/plans",
    organizationId: orgId,
  });
}

export async function notifyTrialExpired(orgId: string) {
  await notifyAdmins({
    type: "TRIAL_EXPIRED",
    title: "انتهت الفترة التجريبية",
    titleEn: "Trial period has expired",
    message: "تم تقييد الوصول. يرجى اختيار خطة لاستعادة الخدمة الكاملة.",
    messageEn: "Access has been restricted. Please select a plan to restore full service.",
    link: "/dashboard/billing/plans",
    organizationId: orgId,
  });
}

export async function notifyPaymentSucceeded(orgId: string, amount: number, invoiceNumber: string) {
  await notifyAdmins({
    type: "PAYMENT_SUCCEEDED",
    title: `تم الدفع بنجاح - ${amount} ر.س`,
    titleEn: `Payment successful - ${amount} SAR`,
    message: `تم تسجيل الدفع للفاتورة ${invoiceNumber}.`,
    messageEn: `Payment recorded for invoice ${invoiceNumber}.`,
    link: "/dashboard/billing",
    organizationId: orgId,
  });
}

export async function notifyPaymentFailed(orgId: string) {
  await notifyAdmins({
    type: "PAYMENT_FAILED",
    title: "فشل الدفع",
    titleEn: "Payment failed",
    message: "يرجى تحديث طريقة الدفع لتجنب انقطاع الخدمة.",
    messageEn: "Please update your payment method to avoid service interruption.",
    link: "/dashboard/billing",
    organizationId: orgId,
  });
}

export async function notifySubscriptionPastDue(orgId: string) {
  await notifyAdmins({
    type: "SUBSCRIPTION_PAST_DUE",
    title: "الدفع متأخر",
    titleEn: "Payment past due",
    message: "اشتراكك متأخر في الدفع. يرجى تحديث طريقة الدفع في أقرب وقت.",
    messageEn: "Your subscription is past due. Please update your payment method soon.",
    link: "/dashboard/billing",
    organizationId: orgId,
  });
}

export async function notifySubscriptionCanceled(orgId: string) {
  await notifyAdmins({
    type: "SUBSCRIPTION_CANCELED",
    title: "تم إلغاء الاشتراك",
    titleEn: "Subscription canceled",
    message: "تم إلغاء اشتراكك. يمكنك إعادة الاشتراك في أي وقت.",
    messageEn: "Your subscription has been canceled. You can resubscribe at any time.",
    link: "/dashboard/billing/plans",
    organizationId: orgId,
  });
}

export async function notifyInvoiceIssued(orgId: string, invoiceNumber: string, total: number) {
  await notifyAdmins({
    type: "INVOICE_ISSUED",
    title: `فاتورة جديدة: ${invoiceNumber}`,
    titleEn: `New invoice: ${invoiceNumber}`,
    message: `تم إصدار فاتورة بمبلغ ${total} ر.س.`,
    messageEn: `An invoice for ${total} SAR has been issued.`,
    link: "/dashboard/billing/invoices",
    organizationId: orgId,
  });
}

export async function notifyUsageLimit80(orgId: string, featureKey: string, current: number, limit: number) {
  const featureNames: Record<string, { ar: string; en: string }> = {
    "users.max": { ar: "المستخدمين", en: "Users" },
    "units.max": { ar: "الوحدات", en: "Units" },
    "customers.max": { ar: "العملاء", en: "Customers" },
    "marketplace.listings.max": { ar: "إعلانات السوق", en: "Marketplace listings" },
    "storage.gb.max": { ar: "مساحة التخزين", en: "Storage" },
  };
  const name = featureNames[featureKey] ?? { ar: featureKey, en: featureKey };

  await notifyAdmins({
    type: "USAGE_LIMIT_80",
    title: `اقتراب من الحد الأقصى: ${name.ar}`,
    titleEn: `Approaching limit: ${name.en}`,
    message: `لقد استخدمت ${current} من ${limit} ${name.ar}. فكر في ترقية خطتك.`,
    messageEn: `You've used ${current} of ${limit} ${name.en}. Consider upgrading your plan.`,
    link: "/dashboard/billing/plans",
    organizationId: orgId,
  });
}

export async function notifyUsageLimit100(orgId: string, featureKey: string, limit: number) {
  const featureNames: Record<string, { ar: string; en: string }> = {
    "users.max": { ar: "المستخدمين", en: "Users" },
    "units.max": { ar: "الوحدات", en: "Units" },
    "customers.max": { ar: "العملاء", en: "Customers" },
    "marketplace.listings.max": { ar: "إعلانات السوق", en: "Marketplace listings" },
    "storage.gb.max": { ar: "مساحة التخزين", en: "Storage" },
  };
  const name = featureNames[featureKey] ?? { ar: featureKey, en: featureKey };

  await notifyAdmins({
    type: "USAGE_LIMIT_100",
    title: `تم الوصول للحد الأقصى: ${name.ar}`,
    titleEn: `Limit reached: ${name.en}`,
    message: `لقد وصلت إلى الحد الأقصى (${limit}) لـ ${name.ar}. قم بترقية خطتك لإضافة المزيد.`,
    messageEn: `You've reached the maximum (${limit}) for ${name.en}. Upgrade your plan to add more.`,
    link: "/dashboard/billing/plans",
    organizationId: orgId,
  });
}

export async function notifyPlanChanged(orgId: string, newPlanName: string, isUpgrade: boolean) {
  await notifyAdmins({
    type: isUpgrade ? "PLAN_UPGRADED" : "PLAN_DOWNGRADED",
    title: isUpgrade ? `تمت ترقية الخطة إلى ${newPlanName}` : `تم تغيير الخطة إلى ${newPlanName}`,
    titleEn: isUpgrade ? `Plan upgraded to ${newPlanName}` : `Plan changed to ${newPlanName}`,
    message: isUpgrade
      ? "تم تفعيل الميزات الجديدة فوراً."
      : "سيتم تطبيق التغيير في نهاية الفترة الحالية.",
    messageEn: isUpgrade
      ? "New features are now active."
      : "Changes will take effect at the end of the current period.",
    link: "/dashboard/billing",
    organizationId: orgId,
  });
}

/**
 * Announce a scheduled plan/price change to an org's admins — in-app (bilingual)
 * + best-effort email (Arabic, Saudi-first). The email never blocks the
 * announcement: a send failure is logged, not thrown.
 */
export async function notifyScheduledPlanChange(
  orgId: string,
  info: {
    sourcePlanNameEn: string;
    sourcePlanNameAr: string;
    targetPlanNameEn: string | null;
    targetPlanNameAr: string | null;
    effectiveAt: Date;
    isMigration: boolean;
  },
) {
  const dateAr = info.effectiveAt.toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
  const dateEn = info.effectiveAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const msgAr =
    info.isMigration && info.targetPlanNameAr
      ? `سيتم نقل اشتراكك من «${info.sourcePlanNameAr}» إلى «${info.targetPlanNameAr}» اعتباراً من ${dateAr}.`
      : `سيتم تحديث سعر خطة «${info.sourcePlanNameAr}» اعتباراً من ${dateAr}.`;
  const msgEn =
    info.isMigration && info.targetPlanNameEn
      ? `Your subscription will move from "${info.sourcePlanNameEn}" to "${info.targetPlanNameEn}" effective ${dateEn}.`
      : `The price of your "${info.sourcePlanNameEn}" plan will be updated effective ${dateEn}.`;

  await notifyAdmins({
    type: "SCHEDULED_PLAN_CHANGE",
    title: info.isMigration ? "تغيير قادم في خطتك" : "تحديث قادم على سعر خطتك",
    titleEn: info.isMigration ? "An upcoming plan change" : "An upcoming price update",
    message: msgAr,
    messageEn: msgEn,
    link: "/dashboard/billing",
    organizationId: orgId,
  });

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://mimarek.sa";
    const admins = await db.user.findMany({
      where: { organizationId: orgId, role: "ADMIN", emailVerified: { not: null } },
      select: { email: true, name: true },
    });
    for (const a of admins) {
      const tpl = scheduledPlanChangeEmail({
        name: a.name,
        sourcePlanName: info.sourcePlanNameAr,
        targetPlanName: info.targetPlanNameAr,
        effectiveAt: info.effectiveAt,
        isMigration: info.isMigration,
        billingUrl: `${baseUrl}/dashboard/billing`,
        lang: "ar",
      });
      await sendTransactionalEmail({ to: a.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }
  } catch (err) {
    console.error("[notifyScheduledPlanChange] email failed:", err);
  }
}
