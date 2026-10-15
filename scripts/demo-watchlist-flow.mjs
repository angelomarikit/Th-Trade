#!/usr/bin/env node
/**
 * Preview QA: add ticker → monitor scan → setup JSON → explain failures.
 * Usage: node scripts/demo-watchlist-flow.mjs [SYMBOL] [API_BASE]
 * Requires SUPABASE access token in WULU_DEMO_TOKEN for authenticated watchlist add.
 */
const API = (process.argv[3] ?? process.env.WULU_PREVIEW_API ?? "https://th-trade-preview.up.railway.app").replace(
  /\/+$/,
  "",
);
const SYMBOL = (process.argv[2] ?? "AAPL").trim().toUpperCase();
const TOKEN = process.env.WULU_DEMO_TOKEN ?? "";

async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API}${path}`, { headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { ok: res.ok, status: res.status, body };
}

async function post(path, token, payload) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload ?? {}),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { ok: res.ok, status: res.status, body };
}

function summarizeSetup(json) {
  const lc = json?.liveCard ?? json?.card;
  if (!lc) return "no liveCard";
  return {
    symbol: lc.symbol,
    status: lc.statusLabel ?? lc.status,
    tradingAction: lc.tradingAction,
    dataFresh: lc.dataFresh,
    dataFreshReason: lc.dataFreshReason,
    price: lc.lastPrice,
    waitingFor: lc.nearActive?.stillWaitingFor?.[0] ?? lc.waitingFor?.[0],
    trigger: lc.alertAt,
    stop: lc.stop,
    t1: lc.target1 ?? lc.t1,
    indicators: (lc.indicatorChecklist ?? []).length,
  };
}

console.log("API", API);
console.log("Symbol", SYMBOL);

const health = await get("/health");
console.log("\n1) Health", health.ok ? "OK" : health.status, health.body?.supportsFastSetup ?? "");

const setup = await get(`/v1/setup?ticker=${SYMBOL}&side=LONG&fast=1`);
console.log("\n2) Scanner setup", setup.ok ? summarizeSetup(setup.body) : setup.body);

if (!TOKEN) {
  console.log("\n3) Watchlist add skipped — set WULU_DEMO_TOKEN for authenticated add/defaults demo.");
  process.exit(0);
}

const added = await post("/v1/monitor/symbols", TOKEN, { symbol: SYMBOL, side: "LONG" });
console.log("\n3) Add to monitor", added.ok ? "OK" : added.status, added.body?.error ?? added.body?.symbols?.length);

const mon = await get("/v1/monitor", TOKEN);
const row = mon.body?.states?.find((s) => s.symbol === SYMBOL);
console.log("\n4) Monitor row", row ? {
  status: row.status,
  action: row.tradingAction,
  fresh: row.dataFresh,
  summary: row.watchingSummary,
  error: row.error,
} : "not found");

console.log("\nDone — open Watchlist + Scanner on Vercel preview to verify chart alignment.");
