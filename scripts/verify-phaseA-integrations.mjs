// §3.9 verification for Phase A — /dashboard/admin/integrations (Moyasar credentials UI).
// system@mimarek.sa (SYSTEM_ADMIN). Verifies: 4-theme render, golden save flow
// (enter creds → success + "Configured"), and tenant-admin redirect (access control).
import { chromium } from "playwright";
import { mkOut, loginState, themedContext, settle, shot, THEME_LANG_COMBOS } from "./lib/capture.mjs";

const B = "http://localhost:3000";
const OUT = mkOut("C:/Users/Ghamd/Desktop/phaseA-integrations-screenshots");
const PASS = [], FAIL = []; const errs = [];
const check = (c, m) => { (c ? PASS : FAIL).push(m); console.log((c ? "PASS" : "FAIL") + ": " + m); };
async function dismiss(p) {
  for (const l of ["Reject non-essential", "رفض غير الضروري", "قبول الكل"]) {
    const b = p.getByRole("button", { name: l }); if (await b.count().catch(() => 0)) { await b.first().click().catch(() => {}); break; }
  }
}
function watch(p, tag) {
  p.on("console", (m) => { if (m.type() === "error") errs.push(`[${tag}] ${m.text()}`); });
  p.on("pageerror", (e) => errs.push(`[${tag}] pageerror: ${e.message}`));
}

const browser = await chromium.launch();
try {
  const { state } = await loginState(browser, "system@mimarek.sa", "mimaric2026");

  // ── 1. Render walk (4 combos) ────────────────────────────────────────────
  for (const [lang, theme] of THEME_LANG_COMBOS) {
    const rtl = lang === "ar" ? "rtl" : "ltr";
    const c = await themedContext(browser, state, lang, theme);
    const p = await c.newPage();
    watch(p, `${theme}-${rtl}`);
    await p.goto(`${B}/dashboard/admin/integrations`, { waitUntil: "networkidle" });
    await settle(p); await dismiss(p); await settle(p);
    const card = await p.getByText(lang === "ar" ? /بوابة الدفع — ميسر/ : /Payment gateway — Moyasar/).first().isVisible().catch(() => false);
    check(card, `[${theme}-${rtl}] Moyasar credentials card renders`);
    const saveBtn = await p.getByRole("button", { name: lang === "ar" ? "حفظ بيانات الاعتماد" : "Save credentials" }).first().isVisible().catch(() => false);
    check(saveBtn, `[${theme}-${rtl}] Save credentials button visible`);
    await shot(p, OUT, `integrations-${theme}-${rtl}`, { settleFirst: false });
    await c.close();
  }

  // ── 2. Golden save flow (en-light): enter creds → success + Configured ────
  {
    const c = await themedContext(browser, state, "en", "light");
    const p = await c.newPage();
    watch(p, "save");
    await p.goto(`${B}/dashboard/admin/integrations`, { waitUntil: "networkidle" });
    await settle(p); await dismiss(p);
    await p.locator("#moyasar-api-key").fill("sk_test_dummy_apikey_123");
    await p.locator("#moyasar-webhook-secret").fill("whsec_dummy_456");
    await p.locator("#moyasar-publishable-key").fill("pk_test_dummy_789");
    await p.getByRole("button", { name: "Save credentials" }).first().click();
    const ok = await p.getByText(/Credentials saved successfully/).first().waitFor({ state: "visible", timeout: 12000 }).then(() => true).catch(() => false);
    check(ok, "[save] entering credentials → success banner (encrypt+store worked)");
    await settle(p);
    // After save the field-status helpers should read "Configured"
    const configured = (await p.getByText(/Configured/).count().catch(() => 0)) >= 1;
    check(configured, "[save] field status flips to 'Configured' after save");
    await shot(p, OUT, "integrations-saved-en-light", { settleFirst: false });
    await c.close();
  }

  // ── 3. Access control: a TENANT admin is redirected off the platform route ─
  {
    const tenant = (await loginState(browser, "admin@mimarek.sa", "mimaric2026")).state;
    const c = await themedContext(browser, tenant, "en", "light");
    const p = await c.newPage();
    watch(p, "tenant");
    await p.goto(`${B}/dashboard/admin/integrations`, { waitUntil: "networkidle" }).catch(() => {});
    await settle(p);
    const url = p.url();
    check(!url.includes("/dashboard/admin/integrations"), `[access] tenant ADMIN redirected off the platform page (landed ${url.replace(B, "")})`);
    await c.close();
  }

  // ── 4. Mobile 375×812 (en-light) ─────────────────────────────────────────
  {
    const c = await themedContext(browser, state, "en", "light", { width: 375, height: 812 });
    const p = await c.newPage();
    watch(p, "mobile");
    await p.goto(`${B}/dashboard/admin/integrations`, { waitUntil: "networkidle" });
    await settle(p); await dismiss(p);
    check(await p.getByRole("button", { name: "Save credentials" }).first().isVisible().catch(() => false), "[mobile] page renders on 375×812");
    await shot(p, OUT, "integrations-mobile", { settleFirst: false });
    await c.close();
  }
} finally {
  await browser.close();
}
console.log("\nCONSOLE_ERRORS:", errs.length);
if (errs.length) console.log(JSON.stringify(errs.slice(0, 10), null, 1));
console.log(`\nRESULT: ${PASS.length} passed, ${FAIL.length} failed`);
if (FAIL.length) { console.log("FAILURES:\n - " + FAIL.join("\n - ")); process.exitCode = 1; }
console.log(`SCREENSHOTS: ${OUT}`);
