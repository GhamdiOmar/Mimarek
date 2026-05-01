#!/usr/bin/env node
// Captures mobile screenshots of Mimaric for the demo deck.
// Requires the dev server running on http://localhost:3000.
// Usage: node docs/demo-deck/capture-screenshots.js

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'screenshots');
const VIEWPORT = { width: 375, height: 812 };

async function login(page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@mimaric.sa');
  await page.fill('input[type="password"]', 'mimaric2026');
  const btn = page.locator('button').filter({ hasText: /تسجيل الدخول|Sign in|Login/i }).first();
  await btn.click();
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  console.log('  ✓ Logged in');
}

async function shot(page, name, url, afterNav) {
  console.log(`  Capturing ${name} …`);
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  if (afterNav) await afterNav(page);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  console.log('Logging in…');
  await login(page);

  console.log('Capturing screenshots…');
  await shot(page, 'shot-dashboard', `${BASE_URL}/dashboard`);
  await shot(page, 'shot-units-list', `${BASE_URL}/dashboard/units`);
  await shot(page, 'shot-crm-list', `${BASE_URL}/dashboard/crm`);
  await shot(page, 'shot-documents', `${BASE_URL}/dashboard/documents`);

  // Payment / finance — try finance route, fall back to dashboard
  const financeRes = await page.goto(`${BASE_URL}/dashboard/finance`);
  if (financeRes && financeRes.status() < 400) {
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT_DIR, 'shot-payments.png') });
    console.log('  ✓ shot-payments.png (finance)');
  } else {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT_DIR, 'shot-payments.png') });
    console.log('  ✓ shot-payments.png (dashboard fallback)');
  }

  await browser.close();
  console.log('\nDone. All screenshots saved to docs/demo-deck/screenshots/');
})();
