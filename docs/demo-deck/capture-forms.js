#!/usr/bin/env node
// Captures add-form screenshots for the demo deck.
// Clicks the FAB (+) button by coordinates, waits for the form/sheet.

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const OUT_DIR  = path.join(__dirname, 'screenshots');
const VIEWPORT = { width: 375, height: 812 };

async function login(page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@mimaric.sa');
  await page.fill('input[type="password"]', 'mimaric2026');
  await (await page.locator('button').filter({ hasText: /تسجيل الدخول/ }).first().elementHandle()).click();
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  console.log('  ✓ Logged in');
}

async function captureWithFab(page, name, url) {
  console.log(`  Navigating to ${url} …`);
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  // Find the FAB button: fixed circle button at bottom of screen
  // Try multiple selectors for the FAB
  const fabSelectors = [
    'button[class*="fab"]',
    'button[class*="float"]',
    'button[aria-label*="جديد"]',
    'button[aria-label*="إضافة"]',
    'button[aria-label*="add"]',
    'a[href*="new"]',
  ];

  let clicked = false;
  for (const sel of fabSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await el.click({ force: true, timeout: 3000 });
        clicked = true;
        console.log(`  ✓ Clicked FAB via selector: ${sel}`);
        break;
      }
    } catch (_) {}
  }

  if (!clicked) {
    // Fallback: click the fixed purple circle at bottom-left (FAB position in the app)
    console.log('  Trying FAB by coordinates (44, 697)…');
    await page.mouse.click(44, 697);
    clicked = true;
  }

  await page.waitForTimeout(1200); // wait for sheet/dialog animation
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  console.log('Logging in…');
  await login(page);

  console.log('\nCapturing add-property form…');
  await captureWithFab(page, 'shot-units-form', `${BASE_URL}/dashboard/units`);

  console.log('\nCapturing add-customer form…');
  await captureWithFab(page, 'shot-crm-form', `${BASE_URL}/dashboard/crm`);

  await browser.close();
  console.log('\nDone.');
})();
