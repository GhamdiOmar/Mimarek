import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object for /dashboard/billing and sub-pages.
 *
 * IMPORTANT: the dashboard `<main>` contains BOTH the mobile tree
 * (`md:hidden`, rendered first in the DOM) and the desktop tree
 * (`hidden md:block`). Plain `main.getByText(...).first()` resolves to the
 * hidden mobile node and fails `toBeVisible()` even when the text is correct.
 * All page-content assertions are therefore scoped to the desktop subtree
 * inside `#main-content` (Playwright runs Desktop Chrome).
 */
export class BillingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Visible desktop page-content scope (excludes the hidden mobile tree and the topbar). */
  private get content(): Locator {
    return this.page.locator('#main-content .hidden.md\\:block');
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  async gotoBilling() {
    await this.page.goto('/dashboard/billing');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoPlans() {
    await this.page.goto('/dashboard/billing/plans');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoInvoices() {
    await this.page.goto('/dashboard/billing/invoices');
    await this.page.waitForLoadState('networkidle');
  }

  // ─── Billing Dashboard ──────────────────────────────────────────────────

  async expectBillingPageLoaded() {
    await expect(
      this.content.getByRole('heading', { name: /الفواتير|Invoices|Billing/i }).first()
    ).toBeVisible();
  }

  async expectCurrentPlanVisible() {
    await expect(
      this.content.getByText(/الخطة الحالية|Current Plan/i).first()
    ).toBeVisible();
  }

  async expectSubscriptionStatus(status: string | RegExp) {
    await expect(
      this.content.getByText(status, { exact: false }).first()
    ).toBeVisible();
  }

  async expectNoSubscription() {
    await expect(
      this.content.getByText(/لا يوجد اشتراك نشط|No active subscription/i).first()
    ).toBeVisible();
  }

  async expectPaymentMethodsSection() {
    await expect(
      this.content.getByText(/طرق الدفع|Payment Methods/i).first()
    ).toBeVisible();
  }

  async expectRecentInvoicesSection() {
    await expect(
      this.content.getByText(/آخر الفواتير|Recent Invoices/i).first()
    ).toBeVisible();
  }

  async expectPastDueBanner() {
    await expect(
      this.content.getByText(/الدفع متأخر|Payment past due|past due/i).first()
    ).toBeVisible();
  }

  async clickChangePlan() {
    await this.content.getByText(/تغيير الخطة|Change Plan/i).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickViewAllInvoices() {
    await this.content.getByText(/عرض الكل|View All/i).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  // ─── Plans Page ──────────────────────────────────────────────────────────

  async expectPlansPageLoaded() {
    await expect(
      this.content
        .getByRole('heading', { name: /اختر خطتك|Choose Your Plan|Choose a Plan|Plans/i })
        .first()
    ).toBeVisible();
  }

  async expectPlanCardVisible(planNamePattern: string | RegExp) {
    await expect(
      this.content.getByText(planNamePattern).first()
    ).toBeVisible();
  }

  async selectMonthlyBilling() {
    // Billing-cycle toggle is a <button>; match by accessible name (substring)
    await this.content.getByRole('button', { name: /شهري|Monthly/i }).first().click();
  }

  async selectAnnualBilling() {
    // Annual toggle <button> also contains the "Save 20%" badge span, so its
    // text is not exactly "سنوي" — match the button's accessible name instead.
    await this.content.getByRole('button', { name: /سنوي|Annual/i }).first().click();
  }

  async clickSubscribePlan(index: number) {
    const buttons = this.content.getByRole('button', {
      name: /ابدأ تجربة مجانية|Start Free Trial|ابدأ الآن|Get Started/i,
    });
    await buttons.nth(index).click();
  }

  async expectCurrentPlanBadge() {
    await expect(
      this.content.getByText(/الخطة الحالية|Current Plan/i).first()
    ).toBeVisible();
  }

  // ─── Coupon Application ────────────────────────────────────────────────
  // Coupon UI exposes data-testid hooks on the desktop tree only.

  async expectCouponSectionVisible() {
    await expect(this.page.locator('[data-testid="coupon-section"]').first()).toBeVisible();
  }

  async enterCouponCode(code: string) {
    const input = this.page.locator('[data-testid="coupon-input"]').first();
    await input.fill(code);
  }

  async clickApplyCoupon() {
    await this.page.locator('[data-testid="apply-coupon-btn"]').first().click();
    // Wait for the server action to complete
    await this.page.waitForTimeout(1000);
  }

  async submitCouponViaEnter(code: string) {
    const input = this.page.locator('[data-testid="coupon-input"]').first();
    await input.fill(code);
    await input.press('Enter');
    await this.page.waitForTimeout(1000);
  }

  async expectCouponApplied(code: string) {
    const section = this.page.locator('[data-testid="coupon-section"]').first();
    await expect(section.getByText(code)).toBeVisible();
  }

  async expectCouponError() {
    await expect(this.page.locator('[data-testid="coupon-error"]').first()).toBeVisible();
  }

  async expectDiscountedPrice() {
    await expect(this.page.locator('[data-testid="discounted-price"]').first()).toBeVisible();
  }

  async expectOriginalPriceStrikethrough() {
    await expect(this.page.locator('[data-testid="original-price"]').first()).toBeVisible();
  }

  async removeCoupon() {
    const section = this.page.locator('[data-testid="coupon-section"]').first();
    await section.locator('button').last().click();
  }

  // ─── Invoices Page ──────────────────────────────────────────────────────

  async expectInvoicesPageLoaded() {
    await expect(
      this.content.getByRole('heading', { name: /الفواتير|Invoices/i }).first()
    ).toBeVisible();
  }

  async expectInvoiceTableVisible() {
    await expect(this.content.locator('table').first()).toBeVisible();
  }

  async expectNoInvoices() {
    await expect(
      this.content.getByText(/لا توجد فواتير|No invoices yet/i).first()
    ).toBeVisible();
  }

  async expectInvoiceRow(invoiceNumber: string) {
    await expect(this.content.getByText(invoiceNumber).first()).toBeVisible();
  }

  async expectInvoiceStatus(invoiceNumber: string, status: string) {
    const row = this.content.locator('tr').filter({ hasText: invoiceNumber });
    await expect(row.getByText(status).first()).toBeVisible();
  }

  async expectVATColumn() {
    await expect(
      this.content.getByText(/ضريبة القيمة المضافة|VAT/i).first()
    ).toBeVisible();
  }

  // ─── Sidebar Navigation ─────────────────────────────────────────────────

  async navigateToBillingViaSidebar() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
    const sidebar = this.page.locator('aside, nav').first();
    await sidebar.getByText(/الاشتراك والفوترة|Billing/i).first().click();
    await this.page.waitForLoadState('networkidle');
  }
}
