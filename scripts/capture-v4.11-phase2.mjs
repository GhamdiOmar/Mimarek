// v4.11 Phase 2 — radial CircleMenu navigation capture. Runs against :3000.
// Saves PNGs to docs/screenshots/v4.11.0/phase2/.
// Surfaces: topbar launcher, desktop 360° hub wheel (L0), expanded children (L1),
// first-run coachmark, mobile bottom launcher + 180° half-wheel.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
const OUT = "docs/screenshots/v4.11.0/phase2";
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 812 };

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

async function prep(page, { path, theme, lang, viewport, coachmark = false }) {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ t, l, c }) => {
      localStorage.setItem("theme", t);
      localStorage.setItem("mimaric-lang", l);
      if (c) localStorage.removeItem("mimaric.circlemenu.coachmark.v1");
      else localStorage.setItem("mimaric.circlemenu.coachmark.v1", "1");
    },
    { t: theme, l: lang, c: coachmark },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
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
  await page.waitForTimeout(600);
}

async function openRadial(page) {
  await page.locator('button[aria-haspopup="dialog"]:visible').first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.waitForTimeout(900); // fan-out + stagger settles
}

async function shot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file);
}

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(120000); // first Turbopack compile is slow
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await login(page, "admin@mimaric.sa", "mimaric2026");

  // 01 — desktop closed state: the labelled topbar launcher (discoverability)
  await prep(page, { path: "/dashboard", theme: "light", lang: "en", viewport: DESKTOP });
  await shot(page, "01-launcher-desktop-light-en");

  // 02–05 — desktop 360° hub wheel (level 0), all four theme×lang
  const l0 = [
    ["02-wheel-l0-light-en", "light", "en"],
    ["03-wheel-l0-dark-ar", "dark", "ar"],
    ["04-wheel-l0-dark-en", "dark", "en"],
    ["05-wheel-l0-light-ar", "light", "ar"],
  ];
  for (const [name, theme, lang] of l0) {
    await prep(page, { path: "/dashboard", theme, lang, viewport: DESKTOP });
    await openRadial(page);
    await shot(page, name);
  }

  // 06–07 — desktop level 1 (CRM & Contracts children)
  for (const [name, theme, lang] of [
    ["06-wheel-l1-crm-light-en", "light", "en"],
    ["07-wheel-l1-crm-dark-ar", "dark", "ar"],
  ]) {
    await prep(page, { path: "/dashboard", theme, lang, viewport: DESKTOP });
    await openRadial(page);
    await page.locator('[data-radial-hub="crm"]').click();
    await page.waitForTimeout(900);
    await shot(page, name);
  }

  // 08 — first-run coachmark (desktop)
  await prep(page, { path: "/dashboard", theme: "light", lang: "en", viewport: DESKTOP, coachmark: true });
  await openRadial(page);
  await shot(page, "08-coachmark-light-en");

  // 09 — mobile closed: bottom-center thumb launcher
  await prep(page, { path: "/dashboard", theme: "light", lang: "en", viewport: MOBILE });
  await shot(page, "09-launcher-mobile-light-en");

  // 10–11 — mobile 180° bottom half-wheel
  for (const [name, theme, lang] of [
    ["10-halfwheel-mobile-light-en", "light", "en"],
    ["11-halfwheel-mobile-dark-ar", "dark", "ar"],
  ]) {
    await prep(page, { path: "/dashboard", theme, lang, viewport: MOBILE });
    await openRadial(page);
    await shot(page, name);
  }

  await ctx.close();
  await browser.close();
  console.log("CONSOLE ERRORS:", errors.length);
  for (const e of errors.slice(0, 20)) console.log("  -", e);
  console.log("DONE");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
