import type { Bar, MarketSnapshot } from "@wulu/market-data";

export type HtfBias = "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";

export function atrPct(bars5m: Bar[], period = 14): number | null {
  const c = bars5m.filter((b) => b.completed);
  if (c.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = c.length - period; i < c.length; i++) {
    const cur = c[i]!;
    const prev = c[i - 1]!;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    trs.push(tr);
  }
  const atr = trs.reduce((a, b) => a + b, 0) / trs.length;
  const lastClose = c.at(-1)!.close;
  return lastClose > 0 ? (atr / lastClose) * 100 : null;
}

export function atrAbs(bars5m: Bar[], period = 14): number | null {
  const pct = atrPct(bars5m, period);
  const last = bars5m.filter((b) => b.completed).at(-1)?.close;
  if (pct == null || last == null) return null;
  return (pct / 100) * last;
}

/** Aggregate N×5m bars into coarse HTF closes for trend (no look-ahead). */
export function aggregateCloses(bars5m: Bar[], groupSize: number): number[] {
  const c = bars5m.filter((b) => b.completed);
  const out: number[] = [];
  for (let i = 0; i < c.length; i += groupSize) {
    const slice = c.slice(i, i + groupSize);
    if (slice.length === groupSize) out.push(slice.at(-1)!.close);
  }
  return out;
}

export function trendFromCompletedBars(
  bars: Bar[],
  minCompleted = 4,
  slopeThreshold = 0.003,
): HtfBias {
  const c = bars.filter((b) => b.completed);
  if (c.length < minCompleted) return "UNKNOWN";
  const first = c[0]!.close;
  const last = c.at(-1)!.close;
  if (!(first > 0)) return "UNKNOWN";
  const slope = (last - first) / first;
  if (slope > slopeThreshold) return "BULLISH";
  if (slope < -slopeThreshold) return "BEARISH";
  return "RANGE";
}

/** Legacy proxy: aggregate 5m when native HTF bars missing. */
export function htfTrendFromAggregated5m(bars5m: Bar[]): HtfBias {
  const h1 = aggregateCloses(bars5m, 12);
  const m15 = aggregateCloses(bars5m, 3);
  const series = h1.length >= 4 ? h1 : m15.length >= 4 ? m15 : [];
  if (series.length < 4) return "UNKNOWN";
  const first = series[0]!;
  const last = series.at(-1)!;
  const slope = (last - first) / first;
  if (slope > 0.004) return "BULLISH";
  if (slope < -0.004) return "BEARISH";
  return "RANGE";
}

export function htfTrend(bars5m: Bar[]): HtfBias {
  return htfTrendFromAggregated5m(bars5m);
}

export interface ResolvedHtf {
  htf1h: HtfBias;
  htf15m: HtfBias;
  /** Best available primary trend (prefers native 1h). */
  primary: HtfBias;
  native1h: boolean;
  native15m: boolean;
}

export function resolveHtfFromSnapshot(
  snapshot: Pick<MarketSnapshot, "bars5m"> & {
    bars15m?: Bar[];
    bars1h?: Bar[];
  },
): ResolvedHtf {
  const bars15m = snapshot.bars15m ?? [];
  const bars1h = snapshot.bars1h ?? [];
  const native1h = bars1h.length > 0;
  const native15m = bars15m.length > 0;
  const htf1h = native1h
    ? trendFromCompletedBars(bars1h, 3, 0.004)
    : htfTrendFromAggregated5m(snapshot.bars5m);
  const htf15m = native15m
    ? trendFromCompletedBars(bars15m, 4, 0.003)
    : trendFromCompletedBars(snapshot.bars5m, 12, 0.002);
  const primary =
    native1h && htf1h !== "UNKNOWN"
      ? htf1h
      : native15m && htf15m !== "UNKNOWN"
        ? htf15m
        : htfTrendFromAggregated5m(snapshot.bars5m);
  return { htf1h, htf15m, primary, native1h, native15m };
}

export function swingResistance(bars5m: Bar[]): number | null {
  const c = bars5m.filter((b) => b.completed);
  if (c.length < 4) return null;
  return Math.max(...c.slice(-12, -1).map((b) => b.high));
}

export function swingSupport(bars5m: Bar[]): number | null {
  const c = bars5m.filter((b) => b.completed);
  if (c.length < 4) return null;
  return Math.min(...c.slice(-12, -1).map((b) => b.low));
}

/** Opening range by America/New_York clock on 1m (preferred) or 5m bars. */
export function openingRangeEt(
  bars: Bar[],
  orbMinutes: number,
  now: Date,
): { high: number; low: number; complete: boolean } | null {
  if (bars.length === 0) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const bag = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>;
  const nowMins = Number(bag.hour) * 60 + Number(bag.minute);
  const rthOpen = 9 * 60 + 30;
  const orEnd = rthOpen + orbMinutes;

  const inOr = bars.filter((b) => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(b.timestamp);
    const bbag = Object.fromEntries(p.map((x) => [x.type, x.value])) as Record<string, string>;
    const mins = Number(bbag.hour) * 60 + Number(bbag.minute);
    return mins >= rthOpen && mins < orEnd;
  });
  if (inOr.length === 0) return null;
  return {
    high: Math.max(...inOr.map((b) => b.high)),
    low: Math.min(...inOr.map((b) => b.low)),
    complete: nowMins >= orEnd,
  };
}

export function relativeVolumeLastBar(bars5m: Bar[]): number | null {
  const c = bars5m.filter((b) => b.completed);
  if (c.length < 6) return null;
  const last = c.at(-1)!;
  const baseline = c.slice(0, -1);
  const avg = baseline.reduce((s, b) => s + b.volume, 0) / baseline.length;
  if (avg <= 0) return null;
  return last.volume / avg;
}

export function breakBarVolumeRatio(bars5m: Bar[], level: number, side: "LONG" | "SHORT"): number | null {
  const c = bars5m.filter((b) => b.completed);
  if (c.length < 6) return null;
  let breakBar: Bar | null = null;
  for (let i = c.length - 1; i >= Math.max(0, c.length - 8); i--) {
    const b = c[i]!;
    if (side === "LONG" && b.close > level) {
      breakBar = b;
      break;
    }
    if (side === "SHORT" && b.close < level) {
      breakBar = b;
      break;
    }
  }
  if (!breakBar) return null;
  const prior = c.slice(0, c.indexOf(breakBar));
  if (prior.length < 3) return null;
  const avg = prior.slice(-5).reduce((s, b) => s + b.volume, 0) / Math.min(5, prior.length);
  return avg > 0 ? breakBar.volume / avg : null;
}
