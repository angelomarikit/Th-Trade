import fs from "node:fs";

function envValue(name) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line.startsWith(`${name}=`)) continue;
    return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const key = envValue("ALPACA_API_KEY_ID");
const secret = envValue("ALPACA_API_SECRET_KEY");
const feed = envValue("ALPACA_DATA_FEED") || "sip";

async function bars(tf, start, end) {
  const timeframe = tf === "1Min" ? "1Min" : "5Min";
  const params = new URLSearchParams({
    timeframe,
    limit: "500",
    adjustment: "raw",
    feed,
    sort: "asc",
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const url = `https://data.alpaca.markets/v2/stocks/TSLA/bars?${params}`;
  const res = await fetch(url, {
    headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret },
  });
  const body = await res.json();
  return { status: res.status, bars: body.bars ?? [], message: body.message };
}

const start = new Date("2026-10-26T13:30:00.000Z");
const end = new Date("2026-10-26T15:30:00.000Z");

for (const tf of ["1Min", "5Min"]) {
  const { status, bars: list, message } = await bars(tf, start, end);
  let maxH = -Infinity;
  let maxBar = null;
  for (const bar of list) {
    if (bar.h > maxH) {
      maxH = bar.h;
      maxBar = bar;
    }
  }
  console.log(JSON.stringify({ tf, status, count: list.length, message, sessionHigh: maxH, highAt: maxBar?.t }, null, 2));
  const touch = list.filter((x) => x.h >= 394.5 && x.h <= 397.5);
  console.log(
    "touch394-397",
    touch.slice(0, 8).map((x) => ({ t: x.t, o: x.o, h: x.h, l: x.l, c: x.c })),
  );
  if (tf === "5Min") {
    console.log(
      "5m_all",
      list.map((x) => ({
        t: x.t.slice(11, 16),
        c: x.c,
        h: x.h,
        closedAbove396: x.c > 396.65,
      })),
    );
  }
}
