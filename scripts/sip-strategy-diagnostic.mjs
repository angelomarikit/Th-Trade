#!/usr/bin/env node
/**
 * SIP + actionable strategy diagnostic for 10 liquid names.
 * Usage:
 *   node scripts/sip-strategy-diagnostic.mjs
 *   API_BASE=https://your-api.railway.app node scripts/sip-strategy-diagnostic.mjs
 */
const API_BASE = (process.env.API_BASE ?? process.env.VITE_API_BASE ?? "http://127.0.0.1:8787").replace(
  /\/$/,
  "",
);

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

function summarizeSymbol(row) {
  const d = row.decision;
  const passed = d.strategiesEvaluated?.filter((s) => s.action === "BUY_CANDIDATE") ?? [];
  const wait = d.strategiesEvaluated?.filter((s) => s.action === "WAIT_FOR_TRIGGER") ?? [];
  return {
    symbol: row.symbol,
    finalAction: d.finalAction,
    rootCause: row.diagnosis?.rootCause,
    summary: row.diagnosis?.summary,
    setupWatch: d.setupWatch ?? null,
    buyStrategies: passed.map((s) => s.strategy),
    waitStrategies: wait.map((s) => ({ strategy: s.strategy, trigger: s.waitTrigger })),
    missing: d.conditionsMissing?.slice(0, 6),
  };
}

async function main() {
  console.log(`API_BASE=${API_BASE}\n`);

  const feedStatus = await getJson("/v1/market-data/feed-status");
  console.log("=== Feed status ===");
  console.log(JSON.stringify(feedStatus, null, 2));

  const diag = await getJson("/v1/actionable/diagnostic");
  console.log("\n=== Actionable diagnostic (10 symbols) ===");
  console.log(`feed=${diag.feed} volumeFeedComparable=${diag.volumeFeedComparable}`);
  for (const row of diag.symbols ?? []) {
    console.log("\n---", summarizeSymbol(row));
  }

  const candidates = (diag.symbols ?? []).filter(
    (r) => r.decision?.finalAction === "BUY_CANDIDATE" && r.decision?.executionEligible,
  );
  console.log(`\nPaper-ready candidates: ${candidates.length}`);
  for (const c of candidates) {
    console.log(JSON.stringify(c.decision?.paperTradePlan ?? c.decision?.primaryStrategy, null, 2));
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
