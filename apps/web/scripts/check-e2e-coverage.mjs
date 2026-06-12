#!/usr/bin/env node
/**
 * E2E zero-coverage guard (v4.18.0 — P4-1).
 *
 * Playwright SILENTLY skips a spec file that matches no project's `testMatch`
 * (it only errors when the ENTIRE run matches zero tests). That is exactly how
 * `marketplace.cross-org.spec.ts` + `marketplace.mylistings-link.spec.ts` got
 * zero CI browser coverage for a strategic module without anyone noticing.
 *
 * This script makes that failure LOUD: it asks Playwright which spec files are
 * actually selected by some project (`--list --reporter=json`), globs every
 * `e2e/**​/*.spec.ts` on disk, and exits non-zero if any spec file is never run.
 * Wire it as a CI step (same philosophy as the F7 RLS drift check).
 *
 * Usage:  node scripts/check-e2e-coverage.mjs   (run from apps/web)
 */
import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const E2E_DIR = join(process.cwd(), "e2e");

/** Recursively collect every *.spec.ts file under e2e/ (full paths). */
function globSpecs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...globSpecs(full));
    else if (entry.endsWith(".spec.ts")) out.push(full);
  }
  return out;
}

/**
 * Recursively pull every spec BASENAME out of the --list JSON. Playwright's
 * reporter emits `file` as a path relative to testDir (often just the basename),
 * which varies by version/OS — so we match on basename, which is unambiguous
 * because spec filenames are unique across e2e/.
 */
function collectRunBasenames(node, acc) {
  if (!node || typeof node !== "object") return;
  for (const key of ["file"]) {
    if (typeof node[key] === "string" && node[key].endsWith(".spec.ts")) {
      acc.add(basename(node[key]));
    }
  }
  if (node.location && typeof node.location.file === "string" && node.location.file.endsWith(".spec.ts")) {
    acc.add(basename(node.location.file));
  }
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) v.forEach((c) => collectRunBasenames(c, acc));
    else if (v && typeof v === "object") collectRunBasenames(v, acc);
  }
}

const allSpecs = globSpecs(E2E_DIR);

let listJson;
try {
  const raw = execSync("npx playwright test --list --reporter=json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  listJson = JSON.parse(raw);
} catch (err) {
  console.error("check-e2e-coverage: failed to list Playwright tests (is DATABASE_URL set?).");
  console.error(err.stdout?.toString?.() ?? err.message);
  process.exit(2);
}

const runBasenames = new Set();
collectRunBasenames(listJson, runBasenames);

const uncovered = allSpecs.filter((f) => !runBasenames.has(basename(f)));

if (uncovered.length > 0) {
  console.error(
    "\n✖ E2E coverage gap — these spec files match NO Playwright project (silently skipped):\n",
  );
  for (const f of uncovered) console.error("   - e2e/" + basename(f));
  console.error(
    "\nAdd a project whose `testMatch` selects them in playwright.config.ts, " +
      "or delete the dead spec. See AGENTS.md / P4-1.\n",
  );
  process.exit(1);
}

console.log(`✓ E2E coverage: all ${allSpecs.length} spec file(s) are selected by a project.`);
