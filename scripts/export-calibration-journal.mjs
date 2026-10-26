#!/usr/bin/env node
/**
 * Export WULU evaluation calibration journal (CSV or JSON).
 *
 * Usage:
 *   node scripts/export-calibration-journal.mjs --api https://th-trade-preview.up.railway.app
 *   node scripts/export-calibration-journal.mjs --api http://localhost:8787 --symbol TSLA --format csv
 *   node scripts/export-calibration-journal.mjs --db ./data/journal/signals.sqlite
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const apiBase = arg("--api", process.env.WULU_API_BASE ?? "").replace(/\/+$/, "");
const dbPath = arg("--db", process.env.JOURNAL_DB_PATH ?? path.join(root, "data", "journal", "signals.sqlite"));
const symbol = arg("--symbol", "");
const format = (arg("--format", "csv") || "csv").toLowerCase();
const out = arg("--out", `wulu-calibration-${new Date().toISOString().slice(0, 10)}.${format === "json" ? "json" : "csv"}`);

async function exportFromApi() {
  const q = new URLSearchParams({ format, limit: "10000" });
  if (symbol) q.set("symbol", symbol.toUpperCase());
  const url = `${apiBase}/v1/journal/calibration/export?${q}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  if (format === "csv") {
    return res.text();
  }
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}

async function exportFromDb() {
  const { SqliteJournalStore, SignalJournal } = await import(
    path.join(root, "packages/journal/dist/index.js")
  );
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Journal DB not found: ${dbPath}`);
  }
  const journal = new SignalJournal(new SqliteJournalStore(dbPath));
  return journal.exportCalibration(
    { symbol: symbol || undefined, limit: 10_000 },
    format === "json" ? "json" : "csv",
  );
}

async function main() {
  let body;
  if (apiBase) {
    body = await exportFromApi();
  } else {
    body = await exportFromDb();
  }
  const target = path.resolve(out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body, "utf8");
  console.log(`Wrote ${target} (${body.length} bytes)`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
