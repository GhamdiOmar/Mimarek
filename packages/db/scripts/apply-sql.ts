/**
 * Generic idempotent SQL-file applier for the one long-lived Supabase DB.
 *
 * Runs a .sql file (multi-statement, simple-query mode) against DATABASE_URL.
 * Used to apply the hand-maintained DDL in packages/db/sql/ (partial indexes,
 * backfills, RLS, CHECK constraints) that `prisma db push` cannot express (§4).
 * The .sql files are written to be idempotent, so re-running is safe.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx packages/db/scripts/apply-sql.ts <path-to.sql>
 */
import "dotenv/config";
import { readFileSync } from "fs";
import pg from "pg";

const file = process.argv[2];
if (!file) throw new Error("Usage: apply-sql.ts <path-to.sql>");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

async function main() {
  const sql = readFileSync(file, "utf8");
  const pool = new pg.Pool({ connectionString });
  try {
    console.log(`Applying ${file} ...`);
    await pool.query(sql); // simple-query mode runs all ;-separated statements
    console.log("Applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
