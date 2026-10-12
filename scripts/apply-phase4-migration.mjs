/**
 * Apply supabase/migrations/20261013_phase4_open_tracks.sql when SUPABASE_DB_URL
 * (or DATABASE_URL) is set. Without a Postgres URL, prints the SQL for the dashboard.
 *
 * Usage:
 *   SUPABASE_DB_URL=postgresql://... node scripts/apply-phase4-migration.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

const sqlPath = path.join(root, "supabase/migrations/20261013_phase4_open_tracks.sql");
const sql = readFileSync(sqlPath, "utf8");
const dbUrl =
  (process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? "").trim();

if (!dbUrl) {
  console.log("No SUPABASE_DB_URL / DATABASE_URL — cannot apply DDL from this machine.");
  console.log("Paste this file in Supabase → SQL → New query → Run:");
  console.log(sqlPath);
  console.log("--- SQL START ---");
  console.log(sql);
  console.log("--- SQL END ---");
  process.exit(2);
}

const { default: pg } = await import("pg").catch(() => ({ default: null }));
if (!pg) {
  console.error("Install pg: npm i -D pg");
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("Applied 20261013_phase4_open_tracks.sql");
} finally {
  await client.end();
}
