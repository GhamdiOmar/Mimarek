/**
 * Read-only query runner for the live Supabase DB — prints rows as JSON.
 * Used for the live-DB prechecks/verifications in the schema sprints (NULL counts,
 * RLS relrowsecurity, ledger reconciliation). Pass the SQL as the single argv.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx packages/db/scripts/run-query.ts "SELECT 1 AS ok"
 */
import "dotenv/config";
import pg from "pg";

const sql = process.argv[2];
if (!sql) throw new Error("Usage: run-query.ts \"<SELECT ...>\"");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

async function main() {
  const pool = new pg.Pool({ connectionString });
  try {
    const res = await pool.query(sql);
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
