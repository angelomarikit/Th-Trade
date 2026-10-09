import type { Bar } from "./types.js";

export function sessionVwap(bars: Bar[]): number | null {
  let pv = 0;
  let vol = 0;
  for (const b of bars) {
    const typical = b.vwap ?? (b.high + b.low + b.close) / 3;
    pv += typical * b.volume;
    vol += b.volume;
  }
  if (vol <= 0) return null;
  return pv / vol;
}

export function averageVolume(bars: Bar[], lookback: number): number | null {
  if (bars.length === 0) return null;
  const slice = bars.slice(-lookback);
  const sum = slice.reduce((a, b) => a + b.volume, 0);
  return sum / slice.length;
}

export function relativeVolume(
  recentBars: Bar[],
  baselineBars: Bar[],
  recentCount = 5,
): number | null {
  const recent = averageVolume(recentBars.slice(-recentCount), recentCount);
  const baseline = averageVolume(baselineBars, baselineBars.length);
  if (recent == null || baseline == null || baseline <= 0) return null;
  return recent / baseline;
}

export function lastCompletedBar(bars: Bar[]): Bar | null {
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i]!.completed) return bars[i]!;
  }
  return null;
}

export function spreadPct(bid: number, ask: number): number | null {
  if (bid <= 0 || ask <= 0 || ask < bid) return null;
  const mid = (bid + ask) / 2;
  return ((ask - bid) / mid) * 100;
}
