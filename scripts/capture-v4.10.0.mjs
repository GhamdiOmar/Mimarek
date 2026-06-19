// One-off release-verification capture for v4.10.0 (UI uniformity pass).
// Runs against the local production server on :3000. Saves PNGs to docs/screenshots/v4.10.0/.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "docs/screenshots/v4.10.0";
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 812 };

async function login(page, email, password) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  // mode stays default "management" -> redirects to /dashboard
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {}),
    page.locator("#login-password").press("Enter"),
  ]);
  await page.waitForTimeout(2000);
}

async function shot(page, { path, name, theme, lang, viewport, tableView }) {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ t, l }) => {
      localStorage.setItem("theme", t);
      localStorage.setItem("mimaric-lang", l);
    },
    { t: theme, l: lang },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  // Wait for client-side data to replace loading skeletons before shooting.
  await page.waitForTimeout(1500);
  await page
    .waitForFunction(
      () => {
        const pulse = document.querySelectorAll(".animate-pulse").length;
        const body = document.body.innerText || "";
        return pulse === 0 && body.length > 200;
      },
      { timeout: 15000 },
    )
    .catch(() => {});
  await page.waitForTimeout(700);
  if (tableView) {
    // units defaults to cards — switch to the migrated DataTable view
    const btn = page.getByRole("button", { name: /^(Table|جدول)$/ }).first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file);
}

const run = async () => {
  const browser = await chromium.launch();

  // ── Tenant session (admin@mimarek.sa) ─────────────────────────────
  const tctx = await browser.newContext({ viewport: DESKTOP });
  const tp = await tctx.newPage();
  await login(tp, "admin@mimarek.sa", "mimaric2026");

  const tenant = [
    { path: "/dashboard/reservations", name: "01-reservations-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    { path: "/dashboard/reservations", name: "02-reservations-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/payments", name: "03-payments-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    { path: "/dashboard/payments", name: "04-payments-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/contracts", name: "05-contracts-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/contracts", name: "06-contracts-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    { path: "/dashboard/units", name: "07-units-table-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP, tableView: true },
    { path: "/dashboard/units", name: "08-units-table-light-en", theme: "light", lang: "en", viewport: DESKTOP, tableView: true },
    { path: "/dashboard/settings/team", name: "09-team-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/maintenance/tickets", name: "10-maint-tickets-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    { path: "/dashboard/marketplace", name: "11-marketplace-tabs-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/settings/audit", name: "12-audit-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    // mobile (tables -> cards)
    { path: "/dashboard/reservations", name: "13-reservations-mobile-dark-ar", theme: "dark", lang: "ar", viewport: MOBILE },
    { path: "/dashboard/payments", name: "14-payments-mobile-light-en", theme: "light", lang: "en", viewport: MOBILE },
  ];
  for (const s of tenant) await shot(tp, s);
  await tctx.close();

  // ── System session (system@mimarek.sa) ───────────────────────────
  const sctx = await browser.newContext({ viewport: DESKTOP });
  const sp = await sctx.newPage();
  await login(sp, "system@mimarek.sa", "mimaric2026");

  const sys = [
    { path: "/dashboard/admin/coupons", name: "15-admin-coupons-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/admin/coupons", name: "16-admin-coupons-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    { path: "/dashboard/admin/subscriptions", name: "17-admin-subscriptions-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/admin/plans", name: "18-admin-plans-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
  ];
  for (const s of sys) await shot(sp, s);
  await sctx.close();

  await browser.close();
  console.log("DONE");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
