#!/usr/bin/env node
/**
 * Cron coverage gate (Hardening Wave B).
 *
 * Root cause of the audit P1: `markOverdueInstallments`, `expireTrials`, and
 * `processDunning` existed as exported functions but had NO cron route and no UI
 * caller — so installments never flipped to OVERDUE, trials never auto-expired,
 * and dunning never fired in production. CI/the import-graph couldn't see it
 * because cron-reachability is a config concern (`vercel.json`), not an import.
 *
 * This gate makes that LOUD: every server-side sweep listed in REQUIRED_SWEEPS
 * MUST be imported by an `app/api/cron/<name>/route.ts` whose path is registered
 * in `vercel.json` crons. Add a new sweep here in the same commit you wire its
 * cron + vercel.json entry. Same philosophy as check-e2e-coverage.mjs / the RLS
 * drift check. Run from apps/web.
 *
 * Usage:  node scripts/check-cron-coverage.mjs   (run from apps/web)
 */
/* global process -- Node.js script run via `node scripts/check-cron-coverage.mjs`; the shared flat config declares no Node globals. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Sweeps that MUST be reachable from a REGISTERED cron route.
const REQUIRED_SWEEPS = [
  "markOverdueInstallmentsInternal",
  "expireTrials",
  "processDunning",
  "autoExpireReservations",
];

const webDir = process.cwd(); // apps/web
const repoRoot = join(webDir, "..", "..");
const cronDir = join(webDir, "app", "api", "cron");
const vercelPath = join(repoRoot, "vercel.json");

const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));
const registeredPaths = new Set((vercel.crons ?? []).map((c) => c.path));

const failures = [];

// 1. Every registered cron path must have a route file.
for (const p of registeredPaths) {
  const rel = p.replace(/^\/api\/cron\//, "");
  const routeFile = join(cronDir, rel, "route.ts");
  if (!existsSync(routeFile)) {
    failures.push(`vercel.json registers ${p} but ${routeFile.replace(webDir + "\\", "").replace(webDir + "/", "")} is missing`);
  }
}

// 2. Every REQUIRED_SWEEP must be imported by some cron route whose path is registered.
const coveredSweeps = new Set();
const routeDirs = existsSync(cronDir)
  ? readdirSync(cronDir, { withFileTypes: true }).filter((d) => d.isDirectory())
  : [];
for (const d of routeDirs) {
  const routeFile = join(cronDir, d.name, "route.ts");
  if (!existsSync(routeFile)) continue;
  const cronPath = `/api/cron/${d.name}`;
  const src = readFileSync(routeFile, "utf8");
  for (const sweep of REQUIRED_SWEEPS) {
    if (src.includes(sweep)) {
      if (registeredPaths.has(cronPath)) coveredSweeps.add(sweep);
      else failures.push(`${sweep} is wired in ${cronPath}/route.ts but that path is NOT in vercel.json crons`);
    }
  }
}
for (const sweep of REQUIRED_SWEEPS) {
  if (!coveredSweeps.has(sweep)) {
    failures.push(`sweep "${sweep}" is not reachable from any REGISTERED cron route`);
  }
}

if (failures.length > 0) {
  console.error("\n✖ Cron coverage gap — a sweep would never run in production:\n");
  for (const f of failures) console.error("   - " + f);
  console.error(
    "\nWire the sweep to app/api/cron/<name>/route.ts AND add its path to vercel.json crons " +
      "(and to REQUIRED_SWEEPS in this script if it is new).\n",
  );
  process.exit(1);
}

console.log(`✓ Cron coverage: all ${REQUIRED_SWEEPS.length} sweep(s) reachable from registered cron routes.`);
