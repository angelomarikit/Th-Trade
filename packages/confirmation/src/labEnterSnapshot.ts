import type { TradeSide } from "@wulu/domain";
import type { Bar, MarketSnapshot, Quote } from "@wulu/market-data";
import { deriveLevels } from "./deriveLevels.js";

/**
 * Lab mock-enter: reshape the SIP replay so price, quote, and last 5m bar
 * match an executable in-zone entry (then gates may still be overlaid for drill).
 */
export function shapeSnapshotForLabEnter(
  snapshot: MarketSnapshot,
  side: TradeSide,
  now: Date,
): MarketSnapshot {
  if (snapshot.bars5m.length < 5) return snapshot;

  const levels = deriveLevels(snapshot.bars5m, side, snapshot.lastPrice);
  const zoneLow = Math.min(levels.entryZoneLow, levels.entryZoneHigh);
  const zoneHigh = Math.max(levels.entryZoneLow, levels.entryZoneHigh);
  const mid = (zoneLow + zoneHigh) / 2;
  const trigger = levels.trigger;
  const buffer = trigger * 0.001;

  const bars5m = snapshot.bars5m.map((b) => ({ ...b }));
  const lastIdx = bars5m.length - 1;
  const prev = bars5m[lastIdx]!;
  const close =
    side === "LONG"
      ? Math.max(mid, trigger + buffer)
      : Math.min(mid, trigger - buffer);
  const open =
    side === "LONG"
      ? Math.min(close * 0.999, close - 0.08)
      : Math.max(close * 1.001, close + 0.08);

  const patched: Bar = {
    ...prev,
    completed: true,
    close,
    open,
    high: side === "LONG" ? Math.max(prev.high, close + 0.12) : Math.max(prev.high, open + 0.05),
    low: side === "LONG" ? Math.min(prev.low, open - 0.05) : Math.min(prev.low, close - 0.12),
    volume: Math.max(prev.volume ?? 0, 50_000),
  };
  bars5m[lastIdx] = patched;

  const quote: Quote = {
    symbol: snapshot.symbol,
    bid: Math.round((mid - 0.02) * 100) / 100,
    ask: Math.round((mid + 0.02) * 100) / 100,
    bidSize: 800,
    askSize: 800,
    timestamp: now,
  };

  const bars1m =
    snapshot.bars1m.length > 0
      ? patchLastBarClose(snapshot.bars1m, close, now)
      : snapshot.bars1m;

  return {
    ...snapshot,
    lastPrice: Math.round(mid * 100) / 100,
    quote,
    bars5m,
    bars1m,
    receivedAt: now,
    marketTimestamp: now,
    priceSource: "quote_mid",
  };
}

function patchLastBarClose(bars: Bar[], close: number, now: Date): Bar[] {
  const out = bars.map((b) => ({ ...b }));
  const last = out[out.length - 1];
  if (!last) return out;
  out[out.length - 1] = {
    ...last,
    completed: true,
    close,
    high: Math.max(last.high, close),
    low: Math.min(last.low, close),
    timestamp: last.timestamp ?? now,
  };
  return out;
}
