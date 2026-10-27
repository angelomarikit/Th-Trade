#!/usr/bin/env node
/**
 * One-shot checklist: local Alpaca keys + preview Railway API.
 * Usage: node scripts/verify-alpaca-and-preview.mjs
 */
import fs from "node:fs";
import path from "node:path";

const PREVIEW = process.env.PREVIEW_API ?? "https://th-trade-preview.up.railway.app";

function envValue(name) {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return "";
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line.startsWith(`${name}=`)) continue;
    return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

async function probeAlpaca() {
  const key = envValue("ALPACA_API_KEY_ID");
  const secret = envValue("ALPACA_API_SECRET_KEY");
  const feed = envValue("ALPACA_DATA_FEED") || "sip";
  if (!key || !secret) {
    console.log("FAIL  local .env — missing ALPACA_API_KEY_ID or ALPACA_API_SECRET_KEY");
    return false;
  }
  const url =
    "https://data.alpaca.markets/v2/stocks/NVDA/bars?" +
    new URLSearchParams({
      timeframe: "5Min",
      limit: "5",
      feed,
      sort: "desc",
    });
  const res = await fetch(url, {
    headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret },
  });
  const ok = res.status === 200;
  let count = 0;
  try {
    const body = await res.json();
    count = body.bars?.length ?? 0;
  } catch {
    /* html error body */
  }
  console.log(
    ok
      ? `PASS  Alpaca direct — HTTP 200, bars=${count} (feed=${feed})`
      : `FAIL  Alpaca direct — HTTP ${res.status} (keys rejected; regenerate in Alpaca dashboard)`,
  );
  return ok;
}

async function probePreview(pathname) {
  const res = await fetch(`${PREVIEW}${pathname}`);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 120) };
  }
  return { status: res.status, body };
}

async function main() {
  console.log("=== WULU preview connectivity ===\n");
  const alpacaOk = await probeAlpaca();

  const health = await probePreview("/health");
  const h = health.body;
  console.log(
    health.status === 200 && h.ok
      ? `PASS  ${PREVIEW}/health — gitCommit=${h.gitCommit ?? "?"} alpacaCredentialsPresent=${h.alpacaCredentialsPresent}`
      : `FAIL  /health — HTTP ${health.status}`,
  );

  const bars = await probePreview("/v1/bars?ticker=NVDA&timeframe=5m&limit=10");
  const b = bars.body;
  console.log(
    bars.status === 200
      ? `INFO  /v1/bars — count=${b.count ?? 0} (0 = auth soft-fail or no session data)`
      : `FAIL  /v1/bars — HTTP ${bars.status}`,
  );

  const setup = await probePreview("/v1/setup?ticker=NVDA&side=LONG&fast=1");
  const s = setup.body;
  const setupOk = setup.status === 200 && !s.error;
  console.log(
    setupOk
      ? `PASS  /v1/setup — lastPrice=${s.liveCard?.lastPrice ?? s.card?.lastPrice ?? "?"}`
      : `FAIL  /v1/setup — ${s.error ?? setup.status} ${s.detail ? `(${s.detail})` : ""}`,
  );

  console.log("\n--- What to fix ---");
  if (!alpacaOk) {
    console.log("1. Alpaca → https://app.alpaca.markets/ → API Keys → Generate NEW key pair.");
    console.log("2. Put Key ID + Secret in repo root .env (not Vercel).");
    console.log("3. node scripts/probe-alpaca-bars.mjs  until status 200.");
    console.log("4. node scripts/railway-fix-alpaca-env.mjs  then Redeploy preview API on Railway.");
  } else if (!setupOk) {
    console.log("Keys work locally — sync Railway preview vars from .env and redeploy API.");
  } else {
    console.log("All checks passed. Hard-refresh Vercel preview on iPhone.");
  }
  console.log("\nNote: Alpaca keys belong on Railway API only. Vercel needs VITE_* (Supabase), not Alpaca.");
}

await main();
