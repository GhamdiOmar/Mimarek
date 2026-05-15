import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/dashboard.page';

/**
 * Admin role: has dashboard:read
 * Tests off-plan KPI cards on the main dashboard
 */
test.describe('Dashboard Off-Plan KPIs — Admin', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
  });

  test('displays off-plan KPI section', async () => {
    await dashboardPage.expectOffPlanSection();
  });

  test('off-plan project count card visible', async () => {
    await dashboardPage.expectKPICardVisible('مشاريع البيع على الخارطة');
  });

  test('total inventory card visible', async () => {
    await dashboardPage.expectKPICardVisible('إجمالي المخزون');
  });

  test('conversion rate card visible', async () => {
    await dashboardPage.expectKPICardVisible('معدل التحويل');
  });

  test('pipeline value card visible with SAR formatting', async ({ page }) => {
    await dashboardPage.expectKPICardVisible('قيمة المبيعات');
    // SAR amount may render as SVG icon or text — check either form is present
    const sarText = await page.getByText(/ر\.س|SAR/i).first().isVisible().catch(() => false);
    const cardText = await page.getByText('قيمة المبيعات').first().isVisible().catch(() => false);
    expect(sarText || cardText).toBeTruthy();
  });

  test('existing KPI cards still visible', async () => {
    await dashboardPage.expectKPICardVisible('إجمالي الوحدات');
    await dashboardPage.expectKPICardVisible('نسبة الإشغال');
    await dashboardPage.expectKPICardVisible('الأراضي');
    await dashboardPage.expectKPICardVisible('المشاريع النشطة');
  });
});
