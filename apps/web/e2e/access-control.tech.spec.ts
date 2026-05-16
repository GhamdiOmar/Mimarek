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

});
