/**
 * generate-rls.ts — generates packages/db/sql/2026-06-enable-rls.sql from schema.prisma.
 *
 * The RLS enable script must cover EVERY table in schema.prisma plus the implicit
 * M2M join table(s) and Prisma's internal `_prisma_migrations` table (AGENTS.md §4
 * coverage contract). Hand-maintenance drifted repeatedly (SubscriptionMrrSnapshot,
 * the 3 marketplace tables, the 2 counters) — so the file is now generated.
 *
 * Table name = the `@@map("...")` value when present inside a model block, else the
 * model name. All names are ALWAYS double-quoted: unquoted mixed-case identifiers
 * fold to lowercase in Postgres and `ALTER TABLE IF EXISTS` then silently no-ops
 * (the 2026-06-12 ConsentLog incident).
 *
 * Usage (from packages/db):
 *   npx tsx scripts/generate-rls.ts            # print generated SQL to stdout
 *   npx tsx scripts/generate-rls.ts --write    # write sql/2026-06-enable-rls.sql
 *   npx tsx scripts/generate-rls.ts --check    # exit 1 if the file on disk drifted
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_PATH = resolve(PKG_DIR, "prisma", "schema.prisma");
const SQL_PATH = resolve(PKG_DIR, "sql", "2026-06-enable-rls.sql");

/** Tables that exist in the database but are not models in schema.prisma. */
const EXTRA_TABLES: ReadonlyArray<{ table: string; comment: string }> = [
  { table: "_CouponPlans", comment: "implicit M2M join table (Plan ↔ Coupon)" },
  { table: "_prisma_migrations", comment: "Prisma internal" },
];

interface TableEntry {
  table: string;
  /** Set when the table name comes from @@map and differs from the model name. */
  mappedFromModel?: string;
}

/** Parse schema.prisma: one entry per `model X { ... }` block, in schema order. */
function parseSchemaTables(schemaSource: string): TableEntry[] {
  const entries: TableEntry[] = [];
  // Model blocks close with a `}` at column 0 (Prisma formatter convention).
  const modelBlock = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let match: RegExpExecArray | null;
  while ((match = modelBlock.exec(schemaSource)) !== null) {
    const [, modelName, body] = match;
    const mapMatch = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
    const table = mapMatch ? mapMatch[1] : modelName;
    entries.push(
      table === modelName ? { table } : { table, mappedFromModel: modelName },
    );
  }
  return entries;
}

function generateSql(tables: TableEntry[]): string {
  const allQuoted = [
    ...tables.map((t) => `public."${t.table}"`),
    ...EXTRA_TABLES.map((t) => `public."${t.table}"`),
  ];
  const pad = Math.max(...allQuoted.map((q) => q.length)) + 1;

  const alterLine = (table: string, comment?: string): string => {
    const target = `public."${table}"`.padEnd(pad);
    const stmt = `ALTER TABLE IF EXISTS ${target}ENABLE ROW LEVEL SECURITY;`;
    return comment ? `${stmt} -- ${comment}` : stmt;
  };

  const lines: string[] = [];

  lines.push(
    "-- ═══════════════════════════════════════════════════════════════════════════",
    "-- MIMAREK — Row Level Security (RLS) Setup",
    "-- Run after `prisma db push` in Supabase SQL Editor (Dashboard → SQL Editor → New query),",
    "-- on every environment (production + any long-lived staging DB).",
    "-- ═══════════════════════════════════════════════════════════════════════════",
    "--",
    "-- STRATEGY",
    "-- --------",
    "-- Mimarek is a pure server-side app (Next.js + Prisma). All database access",
    "-- goes through the `postgres` role via the Supabase connection pooler. That role",
    "-- OWNS these tables and therefore bypasses RLS automatically — no policies are",
    "-- needed for the app to function.",
    "--",
    "-- Enabling RLS without permissive policies achieves two goals:",
    "--   1. Silences the Supabase security advisor (`rls_disabled_in_public`).",
    "--   2. Denies all PostgREST (anon / authenticated) access by default, closing the",
    "--      auto-generated REST API surface to unauthenticated or client-side queries.",
    "--      The public `NEXT_PUBLIC_SUPABASE_ANON_KEY` cannot read or write any row.",
    "--",
    "-- If a future feature requires direct Supabase client access (e.g. realtime",
    "-- subscriptions, public marketplace served via PostgREST), add explicit policies",
    "-- for ONLY those tables at that time — never a blanket permissive policy.",
    "--",
    '-- EXPECTED ADVISOR NOISE — DO NOT "FIX": after this runs, the Supabase advisor',
    "-- reports `rls_enabled_no_policy` (INFO) on every table here. That is the intended",
    "-- state — RLS-on + no-policy IS the firewall. DO NOT silence it by adding a",
    "-- permissive policy (`USING (true)`); that re-opens the PostgREST/anon surface and",
    "-- undoes the whole point. The owner (`postgres`) already bypasses RLS, so the app",
    "-- needs no policy to function. Accept the INFO; never trade it for a policy.",
    "--",
    "-- DO NOT use ALTER TABLE ... FORCE ROW LEVEL SECURITY — that forces the owning",
    "-- `postgres` role through policies that don't exist, which would break every",
    "-- Prisma query. ENABLE (not FORCE) is the firewall; the owner still bypasses it.",
    "--",
    "-- Idempotent: `ENABLE ROW LEVEL SECURITY` is a no-op when already enabled, and",
    "-- `IF EXISTS` skips tables absent on a given environment. Safe to re-run.",
    "--",
    "-- COVERAGE CONTRACT: this file must list EVERY table in schema.prisma plus the",
    "-- implicit M2M join table(s) and Prisma's internal table (AGENTS.md §4).",
    "-- THIS FILE IS GENERATED by scripts/generate-rls.ts from schema.prisma — do NOT",
    "-- edit it by hand. When you add, rename, or remove a model, regenerate it in the",
    "-- same change:  cd packages/db && npx tsx scripts/generate-rls.ts --write",
    "-- CI runs `--check` and fails on any drift between this file and schema.prisma.",
    "-- All table names are double-quoted: unquoted mixed-case identifiers fold to",
    "-- lowercase, making `ALTER TABLE IF EXISTS` silently no-op (never enable RLS).",
    "-- ═══════════════════════════════════════════════════════════════════════════",
    "",
    "-- ── Tables (schema.prisma model order) ───────────────────────────────────────",
  );

  for (const entry of tables) {
    lines.push(
      alterLine(
        entry.table,
        entry.mappedFromModel
          ? `model ${entry.mappedFromModel} (@@map)`
          : undefined,
      ),
    );
  }

  lines.push(
    "",
    "-- ── Non-model tables ─────────────────────────────────────────────────────────",
  );
  for (const extra of EXTRA_TABLES) {
    lines.push(alterLine(extra.table, extra.comment));
  }

  lines.push(
    "",
    "-- ── Verification (optional) — every public table should report relrowsecurity = true ──",
    "-- SELECT relname, relrowsecurity",
    "-- FROM pg_class",
    "-- WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'",
    "-- ORDER BY relrowsecurity, relname;",
    "",
  );

  return lines.join("\n");
}

/** Normalize line endings so CRLF/LF never causes false drift on Windows. */
function normalizeEol(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

function extractTableNames(sql: string): Set<string> {
  const names = new Set<string>();
  const re = /ALTER TABLE IF EXISTS\s+(?:public\.)?"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) names.add(m[1]);
  return names;
}

function main(): void {
  const mode = process.argv[2] ?? "print";
  const schemaSource = readFileSync(SCHEMA_PATH, "utf8");
  const tables = parseSchemaTables(schemaSource);
  const generated = generateSql(tables);

  if (mode === "print") {
    process.stdout.write(generated);
    return;
  }

  if (mode === "--write") {
    // Match the existing file's EOL convention (CRLF on Windows checkouts);
    // default to LF for a fresh file. Always UTF-8 without BOM.
    let output = generated;
    if (existsSync(SQL_PATH) && readFileSync(SQL_PATH, "utf8").includes("\r\n")) {
      output = generated.replace(/\n/g, "\r\n");
    }
    writeFileSync(SQL_PATH, output, { encoding: "utf8" });
    console.log(
      `Wrote ${SQL_PATH} (${tables.length} model tables + ${EXTRA_TABLES.length} non-model tables).`,
    );
    return;
  }

  if (mode === "--check") {
    if (!existsSync(SQL_PATH)) {
      console.error(`DRIFT: ${SQL_PATH} does not exist. Run: npx tsx scripts/generate-rls.ts --write`);
      process.exit(1);
    }
    const onDisk = normalizeEol(readFileSync(SQL_PATH, "utf8"));
    const expected = normalizeEol(generated);
    if (onDisk === expected) {
      console.log(
        `RLS coverage OK — ${tables.length + EXTRA_TABLES.length} tables, file matches schema.prisma.`,
      );
      return;
    }

    const diskNames = extractTableNames(onDisk);
    const genNames = extractTableNames(expected);
    const missing = [...genNames].filter((n) => !diskNames.has(n)).sort();
    const extra = [...diskNames].filter((n) => !genNames.has(n)).sort();

    console.error("DRIFT: sql/2026-06-enable-rls.sql does not match schema.prisma.");
    if (missing.length > 0) {
      console.error(`  Missing from file (in schema, not covered): ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      console.error(`  Extra in file (not in schema): ${extra.join(", ")}`);
    }
    if (missing.length === 0 && extra.length === 0) {
      console.error("  Table coverage matches, but file bytes differ (header/format edited by hand?).");
    }
    console.error("Fix: cd packages/db && npx tsx scripts/generate-rls.ts --write");
    process.exit(1);
  }

  console.error(`Unknown mode "${mode}". Use no args (print), --write, or --check.`);
  process.exit(1);
}

main();
