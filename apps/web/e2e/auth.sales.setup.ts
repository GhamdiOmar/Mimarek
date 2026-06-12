import { test as setup } from '@playwright/test';
import { seedConsentCookie } from './consent-helper';

setup('authenticate as sales agent', async ({ page }) => {
  await page.goto('/auth/login');
  await page.locator('input[type="email"]').fill('sales@demo.sa');
  await page.locator('input[type="password"]').fill('mimaric2026');
  await page.getByRole('button', { name: /Login|تسجيل الدخول/i }).click();
  await page.waitForURL('/dashboard**', { timeout: 15000 });
  await seedConsentCookie(page.context());
  await page.context().storageState({ path: 'e2e/.auth/sales.json' });
});
