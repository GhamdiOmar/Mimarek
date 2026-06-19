// Capture the 5 landing marketing screenshots from the rebranded, populated UI.
// Prereq: prod preview running on :3000 + live DB re-seeded (admin@mimarek.sa).
// Usage: node scripts/capture-rebrand-screenshots.mjs
//
// Cookie-consent handling (per requirement): we DO NOT pre-set the consent
// cookie. We let the banner render, click "Accept all", CONFIRM it has left the
// DOM, and only THEN screenshot — and we hard-assert the banner is gone before
// every single capture.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const EMAIL = "admin@mimarek.sa";
const PASS = "mimaric2026"; // seed password (intentionally unchanged)
const OUT = "apps/web/public/assets/screenshots";

// The consent banner is a role="dialog" labelled by its title, in AR or EN.
const BANNER = '[role="dialog"][aria-label="نحترم خصوصيتك"], [role="dialog"][aria-label="We respect your privacy"]';

const SHOTS = [
  ["dashboard", "/dashboard"],
  ["finance", "/dashboard/finance"],
  ["maintenance", "/dashboard/maintenance"],
  ["rentals", "/dashboard/leasing"],
  ["sales", "/dashboard/crm"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

console.log("→ login");
await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASS);
await page.locator('button[type="submit"], button:has-text("تسجيل الدخول")').first().click();
await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
await page.waitForLoadState("networkidle").catch(() => {});
console.log("  logged in, at", page.url());

// Click "Accept all", then CONFIRM the banner detached from the DOM.
const banner = page.locator(BANNER).first();
await banner.waitFor({ state: "visible", timeout: 12000 });
console.log("  consent banner shown → clicking Accept all");
await page.locator(`:is(${BANNER}) button:has-text("قبول الكل"), :is(${BANNER}) button:has-text("Accept all")`).first().click();
await banner.waitFor({ state: "detached", timeout: 12000 });
console.log("  ✓ consent banner gone");

async function assertNoBanner(name) {
  const n = await page.locator(BANNER).count();
  if (n > 0 && (await page.locator(BANNER).first().isVisible().catch(() => false))) {
    throw new Error(`ABORT: consent banner present before capturing ${name}`);
  }
}

for (const [name, route] of SHOTS) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200); // let KPIs/charts settle
  await assertNoBanner(name); // hard gate — no consent message in any shot
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file }); // viewport frame
  console.log("  wrote", file);
}

await browser.close();
console.log("✓ done");
