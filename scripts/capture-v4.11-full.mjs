// v4.11 FULL verification capture — all phases. Runs against :3000 (prod build).
// Saves PNGs to verification-v4.11.0/. Tenant login (admin@mimaric.sa).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "verification-v4.11.0";
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 812 };

async function login(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#login-email", "admin@mimaric.sa");
  await page.fill("#login-password", "mimaric2026");
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 60000 }).catch(() => {}),
    page.locator("button", { hasText: "تسجيل الدخول" }).first().click(),
  ]);
  await page.waitForTimeout(2500);
}

async function prep(page, { path, theme, lang, viewport }) {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ t, l }) => {
      localStorage.setItem("theme", t);
      localStorage.setItem("mimaric-lang", l);
      localStorage.setItem("mimaric.circlemenu.coachmark.v1", "1");
    },
    { t: theme, l: lang },
  );
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page
    .waitForFunction(
      () => document.querySelectorAll(".animate-pulse").length === 0 && (document.body.innerText || "").length > 120,
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForTimeout(700);
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log("saved", name);
}

async function openRadial(page) {
  await page.locator('button[aria-label="Open navigation menu"]:visible, button[aria-label="فتح قائمة التنقل"]:visible').first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.waitForTimeout(900);
}

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await login(page);

  // ─── PHASE 2 — Radial navigation ───────────────────────────────────────────
  await prep(page, { path: "/dashboard", theme: "light", lang: "en", viewport: DESKTOP });
  await shot(page, "p2-01-desktop-closed-launcher_light-en");

  for (const [name, theme, lang] of [
    ["p2-02-radial-L0_light-en", "light", "en"],
    ["p2-03-radial-L0_dark-ar", "dark", "ar"],
    ["p2-04-radial-L0_dark-en", "dark", "en"],
    ["p2-05-radial-L0_light-ar", "light", "ar"],
  ]) {
    await prep(page, { path: "/dashboard", theme, lang, viewport: DESKTOP });
    await openRadial(page);
    await shot(page, name);
  }

  for (const [name, theme, lang] of [
    ["p2-06-radial-L1-crm_light-en", "light", "en"],
    ["p2-07-radial-L1-crm_dark-ar", "dark", "ar"],
  ]) {
    await prep(page, { path: "/dashboard", theme, lang, viewport: DESKTOP });
    await openRadial(page);
    await page.locator('[data-radial-hub="crm"]').click();
    await page.waitForTimeout(900);
    await shot(page, name);
  }

  await prep(page, { path: "/dashboard", theme: "light", lang: "en", viewport: MOBILE });
  await shot(page, "p2-08-mobile-closed-fab_light-en");
  for (const [name, theme, lang] of [
    ["p2-09-mobile-halfwheel_light-en", "light", "en"],
    ["p2-10-mobile-halfwheel_dark-ar", "dark", "ar"],
  ]) {
    await prep(page, { path: "/dashboard", theme, lang, viewport: MOBILE });
    await openRadial(page);
    await shot(page, name);
  }

  // ─── PHASE 3 — Credibility & swaps ──────────────────────────────────────────
  for (const [name, theme, lang] of [
    ["p3-01-finance-charts_light-en", "light", "en"],
    ["p3-02-finance-charts_dark-ar", "dark", "ar"],
  ]) {
    await prep(page, { path: "/dashboard/finance", theme, lang, viewport: DESKTOP });
    await shot(page, name);
  }

  // Notification filter pills (topbar popover)
  for (const [name, theme, lang] of [
    ["p3-03-notifications-filter_light-en", "light", "en"],
    ["p3-04-notifications-filter_dark-ar", "dark", "ar"],
  ]) {
    await prep(page, { path: "/dashboard/finance", theme, lang, viewport: DESKTOP });
    await page.locator(`button[aria-label="${lang === "ar" ? "الإشعارات" : "Notifications"}"]`).first().click();
    await page.waitForTimeout(800);
    await shot(page, name);
  }

  // Date-range picker open
  for (const [name, theme, lang] of [
    ["p3-05-datepicker_light-en", "light", "en"],
    ["p3-06-datepicker_dark-ar", "dark", "ar"],
  ]) {
    await prep(page, { path: "/dashboard/finance", theme, lang, viewport: DESKTOP });
    await page.locator(`button:has-text("${lang === "ar" ? "اختر الفترة" : "Pick a range"}")`).first().click().catch(() => {});
    await page.waitForTimeout(700);
    await shot(page, name);
  }

  // CRM Kanban (contextual empty copy + cards)
  await prep(page, { path: "/dashboard/crm", theme: "dark", lang: "ar", viewport: DESKTOP });
  await shot(page, "p3-07-crm-kanban_dark-ar");

  // ─── PHASE 4 — Sweeps (side-shading removed) ────────────────────────────────
  for (const [name, theme, lang] of [
    ["p4-01-payments_light-en", "light", "en"],
    ["p4-02-payments_dark-ar", "dark", "ar"],
  ]) {
    await prep(page, { path: "/dashboard/payments", theme, lang, viewport: DESKTOP });
    await shot(page, name);
  }
  await prep(page, { path: "/dashboard/units", theme: "light", lang: "en", viewport: DESKTOP });
  await shot(page, "p4-03-units_light-en");
  await prep(page, { path: "/dashboard/maintenance/tickets", theme: "light", lang: "en", viewport: DESKTOP });
  await shot(page, "p4-04-maintenance-tickets_light-en");

  await ctx.close();
  await browser.close();
  console.log("CONSOLE ERRORS:", errors.length);
  errors.slice(0, 15).forEach((e) => console.log("  -", e));
  console.log("DONE");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
