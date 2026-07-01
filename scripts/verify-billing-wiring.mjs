// §3.9 verification for the tenant billing wiring: "Generate invoice" +
// "Apply coupon" on /dashboard/billing/invoices (admin@mimarek.sa, billing:write).
// Golden path uses real seed data: ACTIVE sub + 0 invoices + WELCOME20 (20%).
import { chromium } from "playwright";
import { mkOut, loginState, themedContext, settle, shot, THEME_LANG_COMBOS } from "./lib/capture.mjs";

const B = "http://localhost:3000";
const OUT = mkOut("C:/Users/Ghamd/Desktop/billing-wiring-screenshots");
const PASS = [], FAIL = [];
const check = (c, m) => { (c ? PASS : FAIL).push(m); console.log((c ? "PASS" : "FAIL") + ": " + m); };
const errs = [];
async function dismiss(p) {
  for (const l of ["Reject non-essential", "رفض غير الضروري", "قبول الكل", "Accept all"]) {
    const b = p.getByRole("button", { name: l }); if (await b.count().catch(() => 0)) { await b.first().click().catch(() => {}); break; }
  }
}
function watch(p, tag) {
  p.on("console", (m) => { if (m.type() === "error") errs.push(`[${tag}] ${m.text()}`); });
  p.on("pageerror", (e) => errs.push(`[${tag}] pageerror: ${e.message}`));
}

const browser = await chromium.launch();
try {
  const { state } = await loginState(browser, "admin@mimarek.sa", "mimaric2026");

  // ── 1. Render walk: Generate button present, 4 combos, 0 console errors ──────
  for (const [lang, theme] of THEME_LANG_COMBOS) {
    const rtl = lang === "ar" ? "rtl" : "ltr";
    const c = await themedContext(browser, state, lang, theme);
    const p = await c.newPage();
    watch(p, `list-${theme}-${rtl}`);
    await p.goto(`${B}/dashboard/billing/invoices`, { waitUntil: "networkidle" });
    await settle(p); await dismiss(p); await settle(p);
    const genBtn = p.getByRole("button", { name: lang === "ar" ? "إنشاء فاتورة" : "Generate invoice" }).first();
    check(await genBtn.isVisible().catch(() => false), `[list ${theme}-${rtl}] "Generate invoice" button visible (billing:write)`);
    await shot(p, OUT, `invoices-${theme}-${rtl}`, { settleFirst: false });
    await c.close();
  }

  // ── 2. Golden path (en-light): generate → apply WELCOME20 → discount renders → dedupe ──
  {
    const c = await themedContext(browser, state, "en", "light");
    const p = await c.newPage();
    watch(p, "golden");
    await p.goto(`${B}/dashboard/billing/invoices`, { waitUntil: "networkidle" });
    await settle(p); await dismiss(p);

    // (a) Generate — the new INV row (or the success banner) appears
    await p.getByRole("button", { name: "Generate invoice" }).first().click();
    const created = await p.getByText(/INV-2026-\d+/).first().waitFor({ state: "visible", timeout: 20000 }).then(() => true).catch(() => false);
    check(created, "[golden] Generate → a new INV-2026 invoice appears");
    await settle(p);
    await shot(p, OUT, "01-generated", { settleFirst: false });

    // (b) Open the new invoice → coupon affordance present
    const viewBtn = p.locator("tr", { hasText: /INV-/ }).first().getByRole("button").first();
    await viewBtn.click().catch(() => {});
    await p.waitForTimeout(800);
    const dialog = p.getByRole("dialog");
    const couponLabel = await dialog.getByText(/Apply a discount coupon/).first().isVisible().catch(() => false);
    check(couponLabel, "[golden] invoice detail shows the 'Apply a discount coupon' affordance");
    await shot(p, OUT, "02-coupon-affordance", { settleFirst: false });

    // (c) Apply WELCOME20 (20%) → discount line renders + affordance disappears
    await dialog.getByPlaceholder(/Coupon code/).first().fill("WELCOME20");
    await dialog.getByRole("button", { name: "Apply" }).first().click();
    const discountShown = await dialog.getByText(/^Discount$/).first().waitFor({ state: "visible", timeout: 12000 }).then(() => true).catch(() => false);
    check(discountShown, "[golden] applying WELCOME20 → the Discount line renders (P1 fix live via real UI)");
    const affordanceGone = !(await dialog.getByText(/Apply a discount coupon/).first().isVisible().catch(() => false));
    check(affordanceGone, "[golden] coupon affordance disappears after apply (couponId now set)");
    await shot(p, OUT, "03-coupon-applied", { settleFirst: false });

    // close, (d) generate again → ALREADY_EXISTS dedupe
    await p.keyboard.press("Escape").catch(() => {});
    await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    await p.getByRole("button", { name: "Generate invoice" }).first().click();
    const deduped = await p.getByText(/already exists/i).first().waitFor({ state: "visible", timeout: 12000 }).then(() => true).catch(() => false);
    check(deduped, "[golden] second Generate → 'already exists' (H-2 server dedupe)");
    await shot(p, OUT, "04-dedupe", { settleFirst: false });
    await c.close();
  }

  // ── 3. ar-dark: the applied discount renders in RTL/dark, no coupon affordance ──
  {
    const c = await themedContext(browser, state, "ar", "dark");
    const p = await c.newPage();
    watch(p, "ar-dark");
    await p.goto(`${B}/dashboard/billing/invoices`, { waitUntil: "networkidle" });
    await settle(p); await dismiss(p);
    const viewBtn = p.locator("tr", { hasText: /INV-/ }).first().getByRole("button").first();
    await viewBtn.click().catch(() => {});
    await p.waitForTimeout(800);
    const dialog = p.getByRole("dialog");
    const discountAr = await dialog.getByText(/^الخصم$/).first().isVisible().catch(() => false);
    check(discountAr, "[ar-dark] the Discount line (الخصم) renders in RTL/dark on the couponed invoice");
    await shot(p, OUT, "05-discount-ar-dark", { settleFirst: false });
    await c.close();
  }

  // ── 4. Mobile 375×812: generate button + couponed invoice discount in the bottom sheet ──
  {
    const c = await themedContext(browser, state, "en", "light", { width: 375, height: 812 });
    const p = await c.newPage();
    watch(p, "mobile");
    await p.goto(`${B}/dashboard/billing/invoices`, { waitUntil: "networkidle" });
    await settle(p); await dismiss(p);
    check(await p.getByRole("button", { name: "Generate invoice" }).first().isVisible().catch(() => false), "[mobile] Generate button visible");
    const card = p.locator("[role='button'], button").filter({ hasText: /INV-/ }).first();
    await card.click().catch(() => {});
    await p.waitForTimeout(900);
    const discountM = await p.getByText(/^Discount$/).first().isVisible().catch(() => false);
    check(discountM, "[mobile] discount line renders in the bottom-sheet detail");
    await shot(p, OUT, "06-mobile", { settleFirst: false });
    await c.close();
  }
} finally {
  await browser.close();
}
console.log("\nCONSOLE_ERRORS:", errs.length);
if (errs.length) console.log(JSON.stringify(errs.slice(0, 12), null, 1));
console.log(`\nRESULT: ${PASS.length} passed, ${FAIL.length} failed`);
if (FAIL.length) { console.log("FAILURES:\n - " + FAIL.join("\n - ")); process.exitCode = 1; }
console.log(`SCREENSHOTS: ${OUT}`);
