import { test, expect, request } from '@playwright/test';

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

    // Document download anchors go through the authorized app route. The page
    // renders BOTH a desktop and a mobile tree (one hidden per viewport), so we
    // assert presence by count — visibility is viewport-dependent and irrelevant
    // to the security property (the href is what matters).
    const authorized = page.locator('a[href^="/api/documents/"]');
    expect(await authorized.count(), 'download links must target /api/documents/').toBeGreaterThan(0);
  });

  test('unauthenticated request to a document route is bounced to login (no file served)', async ({ baseURL }) => {
    // Explicit EMPTY storageState forces a genuinely anonymous request — the
    // admin-tests project's storageState propagates even to request.newContext()
    // and browser.newContext(), so it must be overridden here. maxRedirects:0
    // inspects the route's OWN 307 (Playwright's APIResponse.url() reports the
    // pre-redirect URL, so asserting the followed URL is unreliable).
    const anon = await request.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await anon.get(`${baseURL}/api/documents/any-document-id`, { maxRedirects: 0 });
    // Unauthenticated must be redirected to login — never served a 200 (the file).
    expect(res.status(), 'unauth must be redirected, not served the file').toBe(307);
    expect(res.headers()['location'] ?? '').toContain('/auth/login');
    await anon.dispose();
  });
});
