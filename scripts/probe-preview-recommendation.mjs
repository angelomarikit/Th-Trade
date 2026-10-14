const BASE = process.env.PREVIEW_API ?? "https://th-trade-preview.up.railway.app";
const TICKERS = ["TSLA", "MU", "NVDA", "AMD", "SPY", "QQQ"];

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, json };
}

function pickSetup(j) {
  const lc = j.liveCard ?? j.card ?? {};
  return {
    status: lc.status ?? lc.statusLabel,
    qualityScore10: lc.qualityScore10,
    matrixLen: lc.matrixChecklist?.length ?? 0,
    indicatorLen: lc.indicatorChecklist?.length ?? 0,
    indicators: (lc.indicatorChecklist ?? []).map((i) => `${i.id}:${i.bias}`),
    rr: lc.rewardToRisk,
    dataFresh: lc.dataFresh,
    stop: lc.stop,
  };
}

const health = await get("/health");
console.log("HEALTH", JSON.stringify(health.json, null, 0));

for (const t of TICKERS) {
  const setup = await get(`/v1/setup?ticker=${t}&side=LONG&fast=1`);
  console.log(`SETUP ${t}`, setup.ok ? JSON.stringify(pickSetup(setup.json)) : setup.status);
}

const catalyst = await get("/v1/catalyst?ticker=NVDA");
const cat = catalyst.json?.catalyst ?? catalyst.json;
console.log(
  "CATALYST NVDA",
  catalyst.ok
    ? JSON.stringify({
        headline: cat?.headline?.slice?.(0, 80),
        provider: cat?.provider ?? catalyst.json?.provider,
        mock: cat?.mock,
      })
    : catalyst.status,
);

const mon = await get("/v1/monitor");
const states = mon.json?.states ?? [];
console.log(
  "MONITOR",
  mon.ok
    ? `${states.length} states, failed=${mon.json?.hub?.failedScansLastCycle ?? "?"}`
    : mon.status,
);
for (const s of states.slice(0, 6)) {
  console.log(
    `  ${s.symbol}`,
    s.statusLabel ?? s.status,
    `ind=${s.indicatorChecklist?.length ?? 0}`,
    s.strategyName ?? "",
  );
}
