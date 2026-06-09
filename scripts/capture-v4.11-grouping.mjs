// Validate DataTable collapsible grouped rows on /dashboard/payments. Server on :3000.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "docs/screenshots/v4.11.0";
mkdirSync(OUT, { recursive: true });
const DESKTOP = { width: 1440, height: 900 };

async function login(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#login-email", "admin@mimaric.sa");
  await page.fill("#login-password", "mimaric2026");
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 60000 }).catch(() => {}),
    page.locator("#login-password").press("Enter"),
  ]);
  await page.waitForTimeout(2500);
}

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  await login(page);

  for (const [theme, lang, groupName, name] of [
    ["light", "en", /^Status$/, "16-payments-grouped-status-light-en"],
    ["dark", "ar", /^الحالة$/, "17-payments-grouped-status-dark-ar"],
  ]) {
    await page.goto(`${BASE}/dashboard/payments`, { waitUntil: "domcontentloaded" });
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
    // Open the Group by menu and pick Status
    const gb = page.getByRole("button", { name: /Group by|تجميع حسب/ }).first();
    await gb.click().catch(() => {});
    await page.waitForTimeout(400);
    await page.getByRole("menuitemradio", { name: groupName }).first().click().catch(() => {});
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log("saved", name);
  }

  await ctx.close();
  await browser.close();
  console.log("DONE");
};

run().catch((e) => { console.error(e); process.exit(1); });
