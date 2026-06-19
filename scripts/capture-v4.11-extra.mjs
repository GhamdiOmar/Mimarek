// Supplementary v4.11 captures: maintenance asymmetric priority block (below fold)
// + units Table view (row-action redundancy fix). Server on :3000.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "docs/screenshots/v4.11.0";
mkdirSync(OUT, { recursive: true });
const DESKTOP = { width: 1440, height: 900 };

async function login(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#login-email", "admin@mimarek.sa");
  await page.fill("#login-password", "mimaric2026");
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 60000 }).catch(() => {}),
    page.locator("#login-password").press("Enter"),
  ]);
  await page.waitForTimeout(2500);
}

async function prep(page, path, theme, lang) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ t, l }) => {
      localStorage.setItem("theme", t);
      localStorage.setItem("mimaric-lang", l);
    },
    { t: theme, l: lang },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page
    .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, { timeout: 25000 })
    .catch(() => {});
  await page.waitForTimeout(800);
}

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  await login(page);

  // Maintenance — scroll the "By Priority" card into view
  for (const [theme, lang, name] of [
    ["light", "en", "12-maint-priority-light-en"],
    ["dark", "ar", "13-maint-priority-dark-ar"],
  ]) {
    await prep(page, "/dashboard/maintenance", theme, lang);
    const heading = page.getByText(lang === "ar" ? "حسب الأولوية" : "By Priority").first();
    if (await heading.count()) await heading.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log("saved", name);
  }

  // Units — switch to Table view to show the row-action cluster
  for (const [theme, lang, name] of [
    ["light", "en", "14-units-table-light-en"],
    ["dark", "ar", "15-units-table-dark-ar"],
  ]) {
    await prep(page, "/dashboard/units", theme, lang);
    const tableBtn = page.getByRole("button", { name: /^(Table|جدول)$/ }).first();
    if (await tableBtn.count()) {
      await tableBtn.click().catch(() => {});
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log("saved", name);
  }

  await ctx.close();
  await browser.close();
  console.log("DONE");
};

run().catch((e) => { console.error(e); process.exit(1); });
