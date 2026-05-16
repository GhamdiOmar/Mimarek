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

  test('cannot access reports page', async ({ page }) => {
    await page.goto('/dashboard/reports');
    await page.waitForLoadState('networkidle');
    // Should either redirect or show error/empty state
    const hasError = await page.getByText(/غير مصرح|Unauthorized|Access Denied|Error/i).isVisible().catch(() => false);
    const redirected = !/reports/.test(page.url());
    // Either show error or got redirected
    expect(hasError || redirected).toBeTruthy();
  });

  test('can access maintenance section', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    await page.waitForLoadState('networkidle');
    // Technician SHOULD be able to see maintenance
    await expect(page).toHaveURL(/maintenance/);
  });

});
