#!/usr/bin/env node
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const ROOT = "verification-screenshots";
const LOG = join(ROOT, "verification.log");

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  appendFileSync(LOG, line);
}

const SURFACES_SYSTEM = [
  { name: "admin-dashboard", url: "/dashboard/admin", waitFor: "main" },
  { name: "admin-tickets", url: "/dashboard/admin/tickets", waitFor: "main" },
  { name: "admin-coupons", url: "/dashboard/admin/coupons", waitFor: "main" },
  { name: "admin-subscriptions", url: "/dashboard/admin/subscriptions", waitFor: "main" },
  { name: "admin-seo", url: "/dashboard/admin/seo", waitFor: "main" },
  { name: "billing", url: "/dashboard/billing", waitFor: "main" },
  { name: "settings", url: "/dashboard/settings", waitFor: "main" },
  // Cross-tier block: system user hitting tenant route must 403/redirect
  { name: "BLOCK-system-to-crm", url: "/dashboard/crm", waitFor: "body", expectBlock: true },
  { name: "BLOCK-system-to-units", url: "/dashboard/units", waitFor: "body", expectBlock: true },
];

const SURFACES_TENANT = [
  { name: "dashboard", url: "/dashboard", waitFor: "main" },
  { name: "crm", url: "/dashboard/crm", waitFor: "main" },
  { name: "deals", url: "/dashboard/deals", waitFor: "main" },
  { name: "contracts", url: "/dashboard/contracts", waitFor: "main" },
  { name: "payments", url: "/dashboard/payments", waitFor: "main" },
  { name: "units", url: "/dashboard/units", waitFor: "main" },
  { name: "maintenance", url: "/dashboard/maintenance", waitFor: "main" },
  { name: "leasing", url: "/dashboard/leasing", waitFor: "main" },
  { name: "finance", url: "/dashboard/finance", waitFor: "main" },
  { name: "documents", url: "/dashboard/documents", waitFor: "main" },
  { name: "reports", url: "/dashboard/reports", waitFor: "main" },
  { name: "help", url: "/dashboard/help", waitFor: "main" },
  { name: "settings", url: "/dashboard/settings", waitFor: "main" },
  // Cross-tier block: tenant user hitting admin route must 403/redirect
  { name: "BLOCK-tenant-to-admin", url: "/dashboard/admin", waitFor: "body", expectBlock: true },
  { name: "BLOCK-tenant-to-admin-tickets", url: "/dashboard/admin/tickets", waitFor: "body", expectBlock: true },
];

const THEMES = ["light", "dark"];
const LANGS = ["en", "ar"]; // ar flips dir=rtl via LanguageProvider

async function attemptLogin(page, email, password) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type=password]', { state: "visible", timeout: 25000 });

  // Use per-character typing — React sometimes misses fill() events on small
  // viewports before hydration settles. press("Tab") flushes blur handlers.
  const emailInput = page.locator('input[type=email], input[name=email]').first();
  await emailInput.click();
  await emailInput.fill("");
  await emailInput.type(email, { delay: 10 });
  await emailInput.press("Tab");

  const pwd = page.locator('input[type=password]').first();
  await pwd.click();
  await pwd.fill("");
  await pwd.type(password, { delay: 10 });

  // Button disables while email/password empty. Wait until it's enabled.
  const btn = page.getByRole("button", { name: /log in|sign in|تسجيل|دخول/i }).first();
  await btn.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction(
    () => {
      const btns = Array.from(document.querySelectorAll("button"));
      const b = btns.find((x) => /log in|sign in|تسجيل|دخول/i.test(x.textContent ?? ""));
      return b && !b.disabled;
    },
    { timeout: 10000 },
  );
  await btn.click({ timeout: 10000 });
  await page.waitForURL((u) => !String(u).includes("/auth/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}

async function login(page, email, password) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await attemptLogin(page, email, password);
      return;
    } catch (e) {
      lastErr = e;
      const visibleError = await page.locator(".text-destructive, [role=alert]").first().textContent().catch(() => null);
      log(`  login attempt ${attempt} failed for ${email}: ${e.message.split("\n")[0]} — visibleError=${visibleError ?? "(none)"} url=${page.url()}`);
      if (visibleError && /RATE_LIMITED|too many/i.test(visibleError)) {
        // Don't retry through rate-limit; fail fast
        break;
      }
      await page.waitForTimeout(2000);
    }
  }
  throw lastErr;
}

async function setLang(page, lang) {
  // LanguageProvider stores in mimaric-lang cookie; flip via cookie + reload
  await page.context().addCookies([{ name: "mimaric-lang", value: lang, url: BASE }]);
  await page.context().addCookies([{ name: "lang", value: lang, url: BASE }]);
}

async function setTheme(page, theme) {
  // next-themes stores "theme" in localStorage; also force the class up-front
  await page.evaluate((t) => {
    try { localStorage.setItem("theme", t); } catch {}
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
    document.documentElement.style.colorScheme = t;
  }, theme);
}

async function captureSurface(page, viewport, viewportName, surface, ctx) {
  const folder = join(ROOT, viewportName, ctx.user);
  mkdirSync(folder, { recursive: true });

  const errors = [];
  const failedRequests = [];
  const consoleHandler = (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 300));
  };
  const requestHandler = (req) => {
    // noop; we log failures via response
  };
  const responseHandler = (res) => {
    if (res.status() >= 500) failedRequests.push(`${res.status()} ${res.url().slice(0, 200)}`);
  };
  page.on("console", consoleHandler);
  page.on("response", responseHandler);

  let status = "ok";
  let resolvedUrl = surface.url;
  try {
    await page.setViewportSize(viewport);
    const response = await page.goto(`${BASE}${surface.url}`, {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    // Settle — re-read URL after a body-visible wait to avoid reading
    // mid-redirect URL (false LEAKs when middleware redirect races with
    // the first URL read).
    await page.waitForSelector("body", { state: "visible", timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    resolvedUrl = page.url();
    if (surface.expectBlock) {
      // Double-check: re-read URL once more in case the redirect is still in
      // flight. If either read shows redirect-away, treat as blocked.
      const firstCheck = !resolvedUrl.includes(surface.url);
      await page.waitForTimeout(600);
      const secondUrl = page.url();
      resolvedUrl = secondUrl;
      const secondCheck = !secondUrl.includes(surface.url);
      const httpBlocked = response && (response.status() === 403 || response.status() === 401);
      const blocked = httpBlocked || firstCheck || secondCheck;
      status = blocked ? "blocked-ok" : "LEAK";
    }
  } catch (e) {
    status = `nav-error: ${e.message.slice(0, 120)}`;
  }

  // Re-assert theme + lang after nav (next-themes sometimes resets)
  try {
    await setTheme(page, ctx.theme);
    await page.waitForTimeout(300);
  } catch {}

  const filename = `${surface.name}__${ctx.theme}__${ctx.lang}.png`;
  const fullPath = join(folder, filename);
  try {
    await page.screenshot({ path: fullPath, fullPage: false });
  } catch (e) {
    status = `screenshot-error: ${e.message.slice(0, 120)}`;
  }

  page.off("console", consoleHandler);
  page.off("response", responseHandler);

  log(
    `  [${viewportName}] ${ctx.user}/${surface.name} theme=${ctx.theme} lang=${ctx.lang} -> ${status} url=${resolvedUrl} errs=${errors.length} fails=${failedRequests.length}`,
  );
  if (errors.length) log(`    console-errors: ${errors.slice(0, 3).join(" | ")}`);
  if (failedRequests.length) log(`    failed-req: ${failedRequests.slice(0, 3).join(" | ")}`);

  return { surface: surface.name, viewport: viewportName, theme: ctx.theme, lang: ctx.lang, status, errors: errors.length, failedRequests: failedRequests.length, resolvedUrl, expectBlock: !!surface.expectBlock };
}

async function runUser({ user, email, password, surfaces }) {
  const results = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({
        viewport,
        colorScheme: "light",
        locale: "en-US",
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      log(`== ${user} @ ${viewportName} ==`);
      await login(page, email, password);
      // Do a full pass per theme. Keep lang=en for first pass (broader signal); spot-check AR on desktop.
      const langsForThisViewport = viewportName === "desktop" ? LANGS : ["en"];
      for (const theme of THEMES) {
        for (const lang of langsForThisViewport) {
          await setLang(page, lang);
          await setTheme(page, theme);
          await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
          for (const surface of surfaces) {
            const r = await captureSurface(page, viewport, viewportName, surface, { user, theme, lang });
            results.push(r);
          }
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function main() {
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(LOG, `Verification run ${new Date().toISOString()}\n`);

  const all = [];

  log("### Pass 1: SYSTEM_ADMIN (system@mimaric.sa) ###");
  all.push(
    ...(await runUser({
      user: "system_admin",
      email: "system@mimaric.sa",
      password: "mimaric2026",
      surfaces: SURFACES_SYSTEM,
    })),
  );

  log("### Pass 2: Tenant ADMIN (admin@mimaric.sa) ###");
  all.push(
    ...(await runUser({
      user: "tenant_admin",
      email: "admin@mimaric.sa",
      password: "mimaric2026",
      surfaces: SURFACES_TENANT,
    })),
  );

  // Summary
  const leaks = all.filter((r) => r.status === "LEAK");
  const errs = all.filter((r) => r.errors > 0);
  const fails = all.filter((r) => r.failedRequests > 0);
  const blockedOk = all.filter((r) => r.status === "blocked-ok");
  const navErr = all.filter((r) => String(r.status).startsWith("nav-error"));

  const summary = {
    total: all.length,
    ok: all.filter((r) => r.status === "ok").length,
    blockedOk: blockedOk.length,
    leaks: leaks.length,
    navErrors: navErr.length,
    withConsoleErrors: errs.length,
    withFailedRequests: fails.length,
  };

  log("### SUMMARY ###");
  log(JSON.stringify(summary, null, 2));
  if (leaks.length) {
    log("LEAKS:");
    leaks.forEach((l) => log(`  ${JSON.stringify(l)}`));
  }
  if (errs.length) {
    log("CONSOLE-ERROR SURFACES:");
    errs.slice(0, 20).forEach((l) => log(`  ${l.viewport}/${l.surface} theme=${l.theme} lang=${l.lang} errs=${l.errors}`));
  }

  writeFileSync(
    join(ROOT, "summary.json"),
    JSON.stringify({ summary, results: all }, null, 2),
  );
  log(`Wrote ${join(ROOT, "summary.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
