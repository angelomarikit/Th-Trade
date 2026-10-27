import fs from "node:fs";
import path from "node:path";

function envValue(name) {
  const text = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith(`${name}=`)) continue;
    return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const key = envValue("ALPACA_API_KEY_ID");
const secret = envValue("ALPACA_API_SECRET_KEY");
const feed = envValue("ALPACA_DATA_FEED") || "sip";
if (!key || !secret) {
  console.log("NO_LOCAL_ALPACA_KEYS");
  process.exit(2);
}

async function one(symbol) {
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeframe: "5Min",
    limit: "36",
    adjustment: "raw",
    feed,
    sort: "asc",
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const url = `https://data.alpaca.markets/v2/stocks/${symbol}/bars?${params}`;
  const sw = Date.now();
  const res = await fetch(url, {
    headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret },
  });
  const ms = Date.now() - sw;
  const text = await res.text();
  let count = 0;
  let last = null;
  let message = "";
  try {
    const body = JSON.parse(text);
    count = Array.isArray(body.bars) ? body.bars.length : 0;
    last = body.bars?.at?.(-1)?.t ?? null;
    message = body.message || body.code || "";
  } catch {
    message = text.slice(0, 120);
  }
  console.log(
    JSON.stringify({
      layer: "alpaca",
      symbol,
      feed,
      status: res.status,
      ms,
      count,
      last,
      message: String(message).slice(0, 160),
    }),
  );
}

for (const symbol of ["NVDA", "MU", "TSLA", "AMD"]) {
  await one(symbol);
}
