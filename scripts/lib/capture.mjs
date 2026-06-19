// Shared Playwright login + screenshot helpers for the §3.9 `capture-*.mjs`
// verification scripts. Every capture script re-implemented the same login →
// storageState → themed-context → settle → screenshot flow; this centralises it.
//
// Adopt incrementally — a script can import just the helpers it needs:
//
//   import { chromium } from "playwright";
//   import { mkOut, loginState, makeWatch, themedContext, settle, shot } from "./lib/capture.mjs";
//
//   const OUT = mkOut("verification-v4310");
//   const browser = await chromium.launch();
//   const errs = [];
//   const { state } = await loginState(browser, "admin@mimarek.sa", "mimaric2026");
//   const c = await themedContext(browser, state, "en", "dark");
//   const p = await c.newPage();
//   makeWatch(errs)(p, "en-dark");
//   await p.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
//   await shot(p, OUT, "dashboard-en-dark");
//   await browser.close();

import { mkdirSync } from "node:fs";

export const BASE = "http://localhost:3000";

/** Create (recursively) and return an output directory name. */
export function mkOut(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Log in via the credentials form and return a reusable `storageState` plus the
 * landed URL. Works for both management (`/dashboard`) and tenant (`/portal`)
 * personas; pass `mode: "tenant"` to hit `/auth/login?mode=tenant`.
 */
export async function loginState(browser, email, password, { mode = null, viewport = { width: 1440, height: 1000 } } = {}) {
  const c = await browser.newContext({ viewport });
  const p = await c.newPage();
  const url = mode === "tenant" ? `${BASE}/auth/login?mode=tenant` : `${BASE}/auth/login`;
  await p.goto(url, { waitUntil: "networkidle" });
  await p.fill("#login-email", email);
  await p.fill("#login-password", password);
  await p.keyboard.press("Enter");
  await p.waitForURL(/\/(dashboard|portal)/, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const landed = p.url();
  const state = await c.storageState();
  await c.close();
  return { state, url: landed };
}

/**
 * Return a `(page, tag) => void` console/pageerror watcher that pushes
 * `[tag] message` strings into the provided `errs` array.
 */
export function makeWatch(errs) {
  return function watch(p, tag) {
    p.on("console", (m) => { if (m.type() === "error") errs.push(`[${tag}] ${m.text()}`); });
    p.on("pageerror", (e) => errs.push(`[${tag}] ${e.message}`));
  };
}

/**
 * Build a browser context seeded with the login `state`, the language cookie +
 * `localStorage`, and the theme `localStorage` — the standard themed-context
 * recipe used by every capture script.
 */
export async function themedContext(browser, state, lang, theme, viewport = { width: 1440, height: 1100 }) {
  const c = await browser.newContext({ viewport });
  await c.addCookies([
    ...state.cookies,
    { name: "mimaric-lang", value: lang, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  await c.addInitScript(([l, t]) => {
    try {
      localStorage.setItem("mimaric-lang", l);
      localStorage.setItem("theme", t);
      // Suppress the circle-menu coachmark so it never covers a screenshot.
      localStorage.setItem("mimaric.circlemenu.coachmark.v1", "1");
    } catch {}
  }, [lang, theme]);
  return c;
}

/**
 * Wait for the page to go quiet: network idle, then poll until every
 * `.animate-pulse` skeleton has cleared (memory recipe), then a short settle.
 */
export async function settle(p, { maxPolls = 24, interval = 500 } = {}) {
  await p.waitForLoadState("networkidle").catch(() => {});
  for (let i = 0; i < maxPolls; i++) {
    const n = await p.locator(".animate-pulse").count().catch(() => 0);
    if (n === 0) break;
    await p.waitForTimeout(interval);
  }
  await p.waitForTimeout(400);
}

/** Settle, then full-page screenshot to `${out}/${name}.png`. Returns the path. */
export async function shot(p, out, name, { settleFirst = true } = {}) {
  if (settleFirst) await settle(p);
  const path = `${out}/${name}.png`;
  await p.screenshot({ path, fullPage: true });
  return path;
}

/** The four canonical theme/lang combos every release walks. */
export const THEME_LANG_COMBOS = [
  ["en", "light"],
  ["en", "dark"],
  ["ar", "light"],
  ["ar", "dark"],
];
