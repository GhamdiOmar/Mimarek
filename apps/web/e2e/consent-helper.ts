import type { BrowserContext } from '@playwright/test';

// A valid `mimaric-consent` record (analytics rejected) seeded into each role's
// storageState so the PDPL cookie-consent banner never appears during E2E runs.
// The banner is fixed to the bottom of the viewport (z-1080) and otherwise
// overlays bottom-anchored controls such as the radial-nav launcher, which made
// `billing.admin.spec.ts › nav link navigates to billing page` time out.
// `v` must match CONSENT_VERSION in apps/web/lib/consent.ts.
const CONSENT_VALUE = encodeURIComponent(
  JSON.stringify({
    v: 1,
    ts: '2026-06-12T00:00:00.000Z',
    method: 'banner',
    locale: 'ar',
    categories: { necessary: true, analytics: false },
  }),
);

export async function seedConsentCookie(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: 'mimaric-consent',
      value: CONSENT_VALUE,
      url: 'http://localhost:3000',
    },
  ]);
}
