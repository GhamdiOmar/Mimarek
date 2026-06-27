// Capture screenshots for the Mimarek Product State Dossier.
// Prereq: prod preview running on :3000 (next build && next start) + seeded DB
//         (admin@mimarek.sa tenant org + system@mimarek.sa platform user).
// Usage:  node scripts/capture-dossier-screenshots.mjs
//
// Cookie-consent handling (per requirement): we DO NOT pre-set the consent
// cookie. We let the banner render, click "Accept all", CONFIRM it has left the
// DOM, and only THEN screenshot — hard-asserting the banner is gone before every
// single capture so no shot ever shows the consent dialog.
//
// Theme  : next-themes, attribute="class", default storageKey "theme" → seeded
//          via addInitScript (localStorage.theme) before any page script runs.
// Lang   : cookie `mimaric-lang` (ar|en), server-read for flash-free RTL/LTR SSR
//          → seeded via context cookie + localStorage so SSR + client agree.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const PASS = "mimaric2026"; // seed password (intentionally unchanged)
const OUT = "apps/web/public/assets/screenshots/dossier";
mkdirSync(OUT, { recursive: true });

const BANNER =
  '[role="dialog"][aria-label="نحترم خصوصيتك"], [role="dialog"][aria-label="We respect your privacy"]';

// Tenant surfaces — captured as admin@mimarek.sa (tenant ADMIN).
const TENANT = [
  ["dashboard", "/dashboard"],
  ["crm", "/dashboard/crm"],
  ["units", "/dashboard/units"],
  ["reservations", "/dashboard/reservations"],
  ["contracts", "/dashboard/contracts"],
  ["payments", "/dashboard/payments"],
  ["invoices", "/dashboard/invoices"],
  ["maintenance", "/dashboard/maintenance"],
  ["finance", "/dashboard/finance"],
  ["leasing", "/dashboard/leasing"],
  ["marketplace", "/dashboard/marketplace"],
  ["reports", "/dashboard/reports"],
  ["billing", "/dashboard/billing"],
];

// Capture jobs: { id, email, lang, theme, routes } — each is its own context.
const JOBS = [
  { id: "en-light", email: "admin@mimarek.sa", lang: "en", theme: "light", routes: TENANT },
  { id: "ar-light", email: "admin@mimarek.sa", lang: "ar", theme: "light",
    routes: TENANT.filter(([n]) => ["dashboard", "crm", "finance", "marketplace"].includes(n)) },
  { id: "en-dark", email: "admin@mimarek.sa", lang: "en", theme: "dark",
    routes: TENANT.filter(([n]) => ["dashboard", "crm", "finance"].includes(n)) },
  { id: "en-light", email: "system@mimarek.sa", lang: "en", theme: "light",
    routes: [["admin", "/dashboard/admin"]] },
];

const browser = await chromium.launch();

async function acceptConsent(page) {
  const banner = page.locator(BANNER).first();
  await banner.waitFor({ state: "visible", timeout: 15000 });
  await page
    .locator(
      `:is(${BANNER}) button:has-text("قبول الكل"), :is(${BANNER}) button:has-text("Accept all")`,
    )
    .first()
    .click();
  await banner.waitFor({ state: "detached", timeout: 12000 });
}

async function assertNoBanner(page, name) {
  const n = await page.locator(BANNER).count();
  if (n > 0 && (await page.locator(BANNER).first().isVisible().catch(() => false))) {
    throw new Error(`ABORT: consent banner present before capturing ${name}`);
  }
}

for (const job of JOBS) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina — crisp enough for an executive doc
  });
  // Seed language (cookie is server-authoritative for SSR) + theme before any nav.
  await ctx.addCookies([
    { name: "mimaric-lang", value: job.lang, url: BASE },
  ]);
  await ctx.addInitScript(
    ([lang, theme]) => {
      try {
        localStorage.setItem("mimaric-lang", lang);
        localStorage.setItem("theme", theme);
      } catch {}
    },
    [job.lang, job.theme],
  );

  const page = await ctx.newPage();
  console.log(`→ [${job.email} · ${job.lang} · ${job.theme}] login`);
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill(job.email);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page
    .locator('button[type="submit"], button:has-text("تسجيل الدخول")')
    .first()
    .click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});

  await acceptConsent(page);
  console.log("  ✓ consent accepted + gone");

  for (const [name, route] of job.routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2400); // let KPIs / charts / tables settle
    await assertNoBanner(page, name);
    const file = `${OUT}/${name}-${job.lang}-${job.theme}.png`;
    await page.screenshot({ path: file });
    console.log("  wrote", file);
  }

  await ctx.close();
}

await browser.close();
console.log("✓ done");
