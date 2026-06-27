// Produce a self-contained, shareable copy of the Product State Dossier by
// inlining every referenced screenshot as a base64 data URI.
//
// In:  future-plans/Mimarek-Product-State-Dossier.html           (source, relative img src)
// Out: future-plans/Mimarek-Product-State-Dossier.standalone.html (single shareable file)
//
// Usage: node scripts/inline-dossier-assets.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(process.cwd());
const SRC = resolve(ROOT, "future-plans/Mimarek-Product-State-Dossier.html");
const OUT = resolve(ROOT, "future-plans/Mimarek-Product-State-Dossier.standalone.html");

let html = readFileSync(SRC, "utf8");
const srcDir = dirname(SRC);
let inlined = 0;
let missing = 0;

html = html.replace(/src="([^"]+\.png)"/g, (m, rel) => {
  const abs = resolve(srcDir, rel);
  if (!existsSync(abs)) {
    console.warn("  ! missing:", rel);
    missing++;
    return m;
  }
  const b64 = readFileSync(abs).toString("base64");
  inlined++;
  return `src="data:image/png;base64,${b64}"`;
});

writeFileSync(OUT, html);
const mb = (Buffer.byteLength(html, "utf8") / (1024 * 1024)).toFixed(2);
console.log(`✓ inlined ${inlined} image(s)${missing ? `, ${missing} MISSING` : ""}`);
console.log(`✓ wrote ${OUT} (${mb} MB)`);
