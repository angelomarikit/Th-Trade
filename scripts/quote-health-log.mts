/**
 * WULU — 30-minute RTH quote health log (Step 2 of Blueprint v1.3).
 * Uses the SAME production code paths as the scanner (getSnapshot,
 * assessFreshness, isQuoteUsableForEntry) so the CSV shows exactly which
 * data check blocks entry: QUOTE_MISSING, QUOTE_AGE or SPREAD.
 *
 * Run during regular hours (9:30–4:00 ET) from the repo root:
 *   npx tsx scripts/quote-health-log.mts
 * Optional: LOG_SYMBOLS=TSLA,MU LOG_MINUTES=30 LOG_INTERVAL_MS=30000
 * Needs ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY (root .env or shell env).
 * Read-only: no orders, no database writes.
 */
import { config } from "dotenv";
import { appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessFreshness,
  classifyUsEquitySession,
  confirmationProfileForSession,
  createAlpacaMarketDataFromEnv,
  isQuoteUsableForEntry,
  spreadPct,
} from "../packages/market-data/src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

const SYMBOLS = (process.env.LOG_SYMBOLS ?? "TSLA,MU,NVDA,AMD,SPY,QQQ")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const MINUTES = Number(process.env.LOG_MINUTES ?? 30);
const INTERVAL_MS = Number(process.env.LOG_INTERVAL_MS ?? 30_000);
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const outFile = path.join(root, `quote-health-${stamp}.csv`);
const header = [
  "timestampET",
  "symbol",
  "feed",
  "session",
  "bid",
  "ask",
  "quoteAtET",
  "quoteAgeSec",
  "spreadPct",
  "spreadLimitPct",
  "quoteAgeLimitSec",
  "last5mOpenET",
  "last5mCompleted",
  "freshnessOk",
  "spreadOk",
  "quoteUsable",
  "blockingCheck",
  "freshnessReason",
  "error",
];
writeFileSync(outFile, header.join(",") + "\n");

const et = (d: Date | null | undefined) =>
  d
    ? d.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false })
    : "";
const csv = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const provider = createAlpacaMarketDataFromEnv();
const feed = process.env.ALPACA_DATA_FEED ?? "iex";
const tally = new Map<string, Record<string, number>>();

async function logOnce(symbol: string): Promise<void> {
  const row: Record<string, unknown> = { symbol, feed };
  try {
    const snap = await provider.getSnapshot(symbol);
    const now = new Date();
    const session = classifyUsEquitySession(now);
    const profile = confirmationProfileForSession(session);
    const fresh = assessFreshness(snap, now, profile.maxDataAgeMs, session);
    const q = snap.quote;
    const spread = q ? spreadPct(q.bid, q.ask) : null;
    const spreadOk = spread != null && spread <= profile.maxSpreadPct;
    const usable = isQuoteUsableForEntry(snap, profile.maxSpreadPct);
    const last5 = snap.bars5m.filter((b) => b.completed).at(-1);
    const blocking = !q
      ? "QUOTE_MISSING"
      : !fresh.ok
        ? "QUOTE_AGE"
        : !spreadOk
          ? "SPREAD"
          : "NONE";
    Object.assign(row, {
      timestampET: et(now),
      session: session.session,
      bid: q?.bid ?? "",
      ask: q?.ask ?? "",
      quoteAtET: et(q?.timestamp),
      quoteAgeSec: q
        ? ((now.getTime() - q.timestamp.getTime()) / 1000).toFixed(1)
        : "",
      spreadPct: spread == null ? "" : spread.toFixed(3),
      spreadLimitPct: profile.maxSpreadPct,
      quoteAgeLimitSec: profile.maxDataAgeMs / 1000,
      last5mOpenET: et(last5?.timestamp),
      last5mCompleted: last5?.completed ?? "",
      freshnessOk: fresh.ok,
      spreadOk,
      quoteUsable: usable,
      blockingCheck: blocking,
      freshnessReason: fresh.reason,
    });
    const t = tally.get(symbol) ?? {};
    t[blocking] = (t[blocking] ?? 0) + 1;
    tally.set(symbol, t);
  } catch (err) {
    row.timestampET = et(new Date());
    row.error = err instanceof Error ? err.message : String(err);
  }
  appendFileSync(outFile, header.map((h) => csv(row[h])).join(",") + "\n");
}

const endAt = Date.now() + MINUTES * 60_000;
console.log(
  `Logging ${SYMBOLS.join(", ")} every ${INTERVAL_MS / 1000}s for ${MINUTES} min -> ${outFile}`,
);
while (Date.now() < endAt) {
  const started = Date.now();
  for (const s of SYMBOLS) await logOnce(s);
  const wait = INTERVAL_MS - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
console.log("Done. Blocking check counts per symbol:");
console.table(Object.fromEntries(tally));
console.log(`CSV: ${outFile}`);
