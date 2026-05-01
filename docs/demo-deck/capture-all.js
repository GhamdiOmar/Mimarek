/**
 * capture-all.js — Full marketing screenshot suite
 * Captures every key page in 4 variants: light-EN, dark-EN, light-AR, dark-AR
 * Run: node capture-all.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 375, height: 812 };

const PAGES = [
  { name: 'dashboard',    url: '/dashboard' },
  { name: 'crm',          url: '/dashboard/crm' },
  { name: 'units',        url: '/dashboard/units' },
  { name: 'contracts',    url: '/dashboard/contracts' },
  { name: 'payments',     url: '/dashboard/payments' },
  { name: 'maintenance',  url: '/dashboard/maintenance' },
];

async function login(page) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@mimaric.sa');
  await page.fill('input[type="password"]', 'mimaric2026');
  await page.locator('button').filter({ hasText: /تسجيل الدخول|Sign in|Login/ }).first().click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });
  console.log('✓ Logged in');
}

async function setTheme(page, dark, lang) {
  await page.evaluate(({ dark, lang }) => {
    localStorage.setItem('mimaric-lang', lang);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, { dark, lang });
}

async function applyTheme(page, dark) {
  await page.evaluate((dark) => {
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, dark);
}

async function captureVariant(page, pageName, url, dark, lang) {
  const variant = `${dark ? 'dark' : 'light'}-${lang}`;
  const file = path.join(OUT, `${pageName}-${variant}.png`);

  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState('networkidle');
  await applyTheme(page, dark);

  // Disable animations for clean screenshots
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }'
  });

  // Wait for data to load (no skeleton/loading indicators)
  await page.waitForTimeout(1200);

  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${path.basename(file)}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const lang of ['en', 'ar']) {
    for (const dark of [false, true]) {
      const variant = `${dark ? 'dark' : 'light'}-${lang}`;
      console.log(`\n── ${variant} ──────────────────`);

      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();

      await login(page);
      await setTheme(page, dark, lang);

      for (const { name, url } of PAGES) {
        await captureVariant(page, name, url, dark, lang);
      }

      await context.close();
    }
  }

  await browser.close();
  console.log(`\n✅ Done — ${PAGES.length * 4} screenshots saved to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
