#!/usr/bin/env node
/**
 * Preview API acceptance probes (no auth — setup + health).
 * Auth watchlist flow: set WULU_DEMO_TOKEN and run demo-watchlist-flow.mjs
 */
const API = (process.env.WULU_PREVIEW_API ?? "https://th-trade-preview.up.railway.app").replace(/\/+$/, "");

async function setup(ticker) {
  const res = await fetch(`${API}/v1/setup?ticker=${encodeURIComponent(ticker)}&side=LONG&fast=1`);
  const body = await res.json().catch(() => ({}));
  const lc = body.liveCard ?? body.card;
  if (!lc) return { ticker, http: res.status, error: body.error ?? body.detail ?? body.message };
  return {
    ticker,
    http: res.status,
    session: lc.session?.session,
    status: lc.status ?? lc.statusLabel,
    action: lc.tradingAction ?? body.signalRecommendation?.action,
    fresh: lc.dataFresh,
    freshReason: lc.dataFreshReason,
    price: lc.lastPrice,
    trigger: lc.alertAt,
    stop: lc.stop,
    t1: lc.t1 ?? lc.target1,
    waiting: (lc.nearActive?.stillWaitingFor ?? lc.waitingFor ?? [])[0],
    strategy: lc.matchedStrategies?.[0]?.strategyName ?? lc.historicalEdge?.strategyName,
    indicators: (lc.indicatorChecklist ?? []).length,
    watchingSummary: lc.watchingSummary,
  };
}

const health = await fetch(`${API}/health`).then((r) => r.json());
console.log("=== HEALTH ===");
console.log({
  ok: health.ok,
  gitCommit: health.gitCommit,
  previewDevWatchlist: health.monitor?.previewDevWatchlist,
  effectiveWatchlistMax: health.monitor?.effectiveWatchlistMax,
  supportsFastSetup: health.supportsFastSetup,
  session: new Date().toISOString(),
});

console.log("\n=== SETUP (core six + new ticker) ===");
for (const t of ["TSLA", "MU", "NVDA", "AMD", "SPY", "QQQ", "AAPL"]) {
  console.log(await setup(t));
}

console.log("\n=== INVALID TICKER (must not crash API) ===");
const bad = await fetch(`${API}/v1/setup?ticker=!!!&side=LONG&fast=1`);
console.log("!!!", bad.status, (await bad.text()).slice(0, 160));
const zzz = await setup("ZZZZ");
console.log("ZZZZ", zzz);
