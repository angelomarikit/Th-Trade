import type { Bar } from "@wulu/market-data";

export function vwap(bars: Bar[]): number | null {
  let pv = 0;
  let vol = 0;
  for (const b of bars) {
    const typical = b.vwap ?? (b.high + b.low + b.close) / 3;
    pv += typical * b.volume;
    vol += b.volume;
  }
  return vol > 0 ? pv / vol : null;
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function bollinger(
  closes: number[],
  period = 20,
  mult = 2,
): { mid: number; upper: number; lower: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { mid, upper: mid + mult * sd, lower: mid - mult * sd };
}

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]!];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i]! * k + out[i - 1]! * (1 - k));
  }
  return out;
}

export function macdHistogram(closes: number[]): number | null {
  if (closes.length < 35) return null;
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]!);
  const signal = ema(macdLine, 9);
  const last = macdLine.length - 1;
  return macdLine[last]! - signal[last]!;
}

export function openingRange(bars: Bar[], minutes = 30): { high: number; low: number } | null {
  if (bars.length === 0) return null;
  // Approximate: first N 5m bars (30m => 6 bars)
  const n = Math.max(1, Math.ceil(minutes / 5));
  const slice = bars.slice(0, Math.min(n, bars.length));
  return {
    high: Math.max(...slice.map((b) => b.high)),
    low: Math.min(...slice.map((b) => b.low)),
  };
}

export function longLevels(entry: number, stop: number, rMultipleT1 = 1.8, rMultipleT2 = 3) {
  const risk = Math.abs(entry - stop);
  return {
    entry,
    stop,
    target1: entry + risk * rMultipleT1,
    target2: entry + risk * rMultipleT2,
  };
}

export function shortLevels(entry: number, stop: number, rMultipleT1 = 1.8, rMultipleT2 = 3) {
  const risk = Math.abs(stop - entry);
  return {
    entry,
    stop,
    target1: entry - risk * rMultipleT1,
    target2: entry - risk * rMultipleT2,
  };
}
