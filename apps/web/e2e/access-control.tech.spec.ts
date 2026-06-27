import { test, expect } from '@playwright/test';

/**
 * Technician role: only has maintenance-related permissions
 * Negative tests — verify restricted access
 */
test.describe('Access Control — Technician (Negative)', () => {
  test('can access dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Technician should be able to see the dashboard
    await expect(page).toHaveURL(/dashboard/);
  });

  test('can access maintenance section', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    await page.waitForLoadState('networkidle');
    // Technician SHOULD be able to see maintenance
    await expect(page).toHaveURL(/maintenance/);
  });

  test('cannot read CRM customer data — sees AccessDenied (SEC-004)', async ({ page }) => {
    await page.goto('/dashboard/crm');
    await page.waitForLoadState('networkidle');
    // TECHNICIAN lacks crm:read → the in-shell 403 (AccessDenied) renders instead
    // of the customer table. Matches either UI language (RTL-first default = AR).
    await expect(
      page.getByText(/access to this page|ليس لديك صلاحية الوصول/i).first()
    ).toBeVisible();
  });

});
