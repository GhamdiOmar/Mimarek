// Render-check the standalone dossier: confirm every embedded image decoded,
// then capture section screenshots for visual review.
// Usage: node scripts/verify-dossier.mjs
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const FILE = resolve(process.cwd(), "future-plans/Mimarek-Product-State-Dossier.standalone.html");
const OUT = resolve(process.cwd(), "apps/web/public/assets/screenshots/dossier/_render");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1340, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(FILE).href, { waitUntil: "networkidle" });

// Trigger lazy-loaded images by scrolling the full page, then return to top.
await page.evaluate(async () => {
  const step = window.innerHeight;
  for (let y = 0; y <= document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(800);

const imgStatus = await page.$$eval("img", (imgs) =>
  imgs.map((i) => ({ ok: i.naturalWidth > 0, w: i.naturalWidth })),
);
const broken = imgStatus.filter((i) => !i.ok).length;
console.log(`images: ${imgStatus.length} total, ${broken} broken`);

for (const sel of ["header.cover", "#positioning", "#capabilities", "#tour", "#roles", "#arabic", "#personas", "#appendix"]) {
  const el = await page.$(sel);
  if (!el) { console.log("  ! not found:", sel); continue; }
  const name = sel.replace(/[#.]/g, "");
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log("  shot", name);
}

await browser.close();
console.log(broken === 0 ? "✓ all images decoded" : `✗ ${broken} broken images`);
