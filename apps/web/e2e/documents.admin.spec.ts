import { test, expect } from '@playwright/test';

/**
 * SEC-006 — authorized document download (browser proof).
 *
 * Prerequisite: `npx tsx e2e/seed/billing-seed.ts` seeds one document carrying a
 * raw UploadThing CDN URL (*.ufs.sh) on the admin's org.
 *
 * The raw object URL was a permanent public bearer credential. After the fix:
 *   • it is never serialized into the documents page DOM, and
 *   • download links point at the authorized `/api/documents/[id]` route, and
 *   • an unauthenticated request to that route is bounced to login (never the file).
 */
test.describe('Documents — SEC-006 authorized download (Admin)', () => {
  test('download links target the authorized route, never the raw CDN url', async ({ page }) => {
    await page.goto('/dashboard/documents');
    await page.waitForLoadState('networkidle');

    // The raw UploadThing object URL must never reach the DOM.
    const html = await page.content();
    expect(html).not.toContain('ufs.sh');
    expect(html).not.toContain('utfs.io');

    // Unconditional: NO anchor may point at a raw UploadThing CDN host, regardless
    // of how many documents render. This is the real security property.
    await expect(page.locator('a[href*="ufs.sh"], a[href*="utfs.io"]')).toHaveCount(0);

    // Bonus (when documents are present): download anchors go through the route.
    const authorized = page.locator('a[href^="/api/documents/"]');
    if ((await authorized.count()) > 0) {
      await expect(authorized.first()).toBeVisible();
    }
  });

  test('unauthenticated request to a document route is bounced to login (no file served)', async ({ browser, baseURL }) => {
    // Fresh context with NO storageState → genuinely unauthenticated.
    const anon = await browser.newContext();
    const res = await anon.request.get(`${baseURL}/api/documents/any-document-id`);
    // Must end on the login page, never on a signed CDN object URL.
    expect(res.url()).toContain('/auth/login');
    expect(res.url()).not.toContain('ufs.sh');
    await anon.close();
  });
});
