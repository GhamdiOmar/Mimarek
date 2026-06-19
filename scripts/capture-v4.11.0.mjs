// v4.11 UI-overhaul validation capture. Runs against the local server on :3000.
// Saves PNGs to docs/screenshots/v4.11.0/. Surfaces: Outlined Precision cards,
// de-glassed PageIntro, CRM Kanban redesign, asymmetric maintenance priority.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "docs/screenshots/v4.11.0";
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };

async function login(page, email, password) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 60000 }).catch(() => {}),
    page.locator("#login-password").press("Enter"),
  ]);
  await page.waitForTimeout(2500);
}

async function shot(page, { path, name, theme, lang, viewport }) {
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
  await page.waitForTimeout(2000);
  await page
    .waitForFunction(
      () => {
        const pulse = document.querySelectorAll(".animate-pulse").length;
        const body = document.body.innerText || "";
        return pulse === 0 && body.length > 200;
      },
      { timeout: 25000 },
    )
    .catch(() => {});
  await page.waitForTimeout(900);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file);
}

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  await login(page, "admin@mimarek.sa", "mimaric2026");

  const shots = [
    // CRM Kanban redesign — the headline (all 4)
    { path: "/dashboard/crm", name: "01-crm-kanban-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/crm", name: "02-crm-kanban-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    { path: "/dashboard/crm", name: "03-crm-kanban-dark-en", theme: "dark", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/crm", name: "04-crm-kanban-light-ar", theme: "light", lang: "ar", viewport: DESKTOP },
    // Dashboard — Outlined Precision cards + de-glassed greeting hero
    { path: "/dashboard", name: "05-dashboard-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard", name: "06-dashboard-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    // Finance — de-glassed PageIntro + KPICard top-rule tier
    { path: "/dashboard/finance", name: "07-finance-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/finance", name: "08-finance-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    // Maintenance — asymmetric priority block
    { path: "/dashboard/maintenance", name: "09-maintenance-light-en", theme: "light", lang: "en", viewport: DESKTOP },
    { path: "/dashboard/maintenance", name: "10-maintenance-dark-ar", theme: "dark", lang: "ar", viewport: DESKTOP },
    // Units — row-action redundancy fix (table)
    { path: "/dashboard/units", name: "11-units-light-en", theme: "light", lang: "en", viewport: DESKTOP },
  ];
  for (const s of shots) await shot(page, s);

  await ctx.close();
  await browser.close();
  console.log("DONE");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
