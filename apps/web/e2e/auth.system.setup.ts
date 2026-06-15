import { test as setup } from '@playwright/test';
import { seedConsentCookie } from './consent-helper';

// CX-017 — authenticate as a SYSTEM (platform staff) user so the accessibility
// scan can cover the /dashboard/admin/* platform surfaces. system@mimaric.sa is
// seeded as SYSTEM_ADMIN (packages/db/prisma/seed.ts) and logs in via the default
// (management) mode; the authorized callback redirects system users to
// /dashboard/admin.
setup('authenticate as system admin', async ({ page }) => {
  await page.goto('/auth/login');
  await page.locator('input[type="email"]').fill('system@mimaric.sa');
  await page.locator('input[type="password"]').fill('mimaric2026');
  await page.getByRole('button', { name: /Login|تسجيل الدخول/i }).click();
  await page.waitForURL('/dashboard**', { timeout: 15000 });
  await seedConsentCookie(page.context());
  await page.context().storageState({ path: 'e2e/.auth/system.json' });
});
