// Build the Mimarek PRD deliverables:
//   1. inline all referenced PNG + SVG assets as base64 → self-contained standalone HTML
//   2. render-verify on desktop AND iPhone 16 Pro (393x852)
//   3. print an A4 PDF with logo + screenshots
// Usage: node scripts/build-prd.mjs
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(process.cwd());
const SRC = resolve(ROOT, "future-plans/Mimarek-PRD.html");
const OUT = resolve(ROOT, "future-plans/Mimarek-PRD.standalone.html");
const PDF = resolve(ROOT, "future-plans/Mimarek-PRD.pdf");
const SHOTS = resolve(ROOT, "apps/web/public/assets/screenshots/dossier/_render");
mkdirSync(SHOTS, { recursive: true });

// ---- 1. inline assets ----
let html = readFileSync(SRC, "utf8");
const srcDir = dirname(SRC);
const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };
let inlined = 0, missing = 0;
html = html.replace(/src="([^"]+\.(?:png|jpe?g|svg))"/g, (m, rel) => {
  const abs = resolve(srcDir, rel);
  if (!existsSync(abs)) { console.warn("  ! missing:", rel); missing++; return m; }
  const b64 = readFileSync(abs).toString("base64");
  inlined++;
  return `src="data:${mime[extname(abs).toLowerCase()]};base64,${b64}"`;
});
writeFileSync(OUT, html);
console.log(`inlined ${inlined} asset(s)${missing ? `, ${missing} MISSING` : ""}, standalone ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB`);

// ---- 2 + 3. render-verify + PDF ----
const url = pathToFileURL(OUT).href;
const browser = await chromium.launch();

async function loadAll(page) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

// Desktop
const dctx = await browser.newContext({ viewport: { width: 1340, height: 1000 }, deviceScaleFactor: 1.5 });
const dpage = await dctx.newPage();
await loadAll(dpage);
const broken = (await dpage.$$eval("img", (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).length));
console.log(`desktop images broken: ${broken}`);
for (const sel of ["header.cover", "#brand", "#roles", "#prds", "#tour"]) {
  const el = await dpage.$(sel); if (el) await el.screenshot({ path: `${SHOTS}/prd-desktop-${sel.replace(/[#.]/g, "")}.png` });
}
// PDF (print media, A4, backgrounds on)
await dpage.emulateMedia({ media: "print" });
await dpage.pdf({ path: PDF, format: "A4", printBackground: true, preferCSSPageSize: true,
  margin: { top: "0", bottom: "0", left: "0", right: "0" } });
console.log("PDF written:", PDF);
await dctx.close();

// iPhone 16 Pro (393 x 852)
const mctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
await loadAll(mpage);
for (const sel of ["header.cover", "#brand", "#roles", "#tour", "#summary"]) {
  const el = await mpage.$(sel); if (el) await el.screenshot({ path: `${SHOTS}/prd-mobile-${sel.replace(/[#.]/g, "")}.png` });
}
// full mobile cover+topbar region
await mpage.screenshot({ path: `${SHOTS}/prd-mobile-viewport.png` });
await mctx.close();

await browser.close();
console.log(broken === 0 ? "✓ all images decoded; PDF + mobile/desktop shots ready" : `✗ ${broken} broken images`);
