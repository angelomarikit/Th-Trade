import type { ChartBar } from "./api";

export function emaSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i]!;
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    if (prev == null) {
      const seed = closes.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out.push(seed);
      continue;
    }
    prev = c * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function bollingerSeries(
  closes: number[],
  period: number,
  mult: number,
): { upper: (number | null)[]; mid: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = [];
  const mid: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i + 1 < period) {
      upper.push(null);
      mid.push(null);
      lower.push(null);
      continue;
    }
    const window = closes.slice(i + 1 - period, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    mid.push(mean);
    upper.push(mean + mult * std);
    lower.push(mean - mult * std);
  }
  return { upper, mid, lower };
}

/** Wilder RSI — matches common platform defaults (14). */
export function rsiSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      out.push(null);
      continue;
    }
    if (i > period) {
      const diff = closes[i]! - closes[i - 1]!;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
}

export function studiesFromBars(bars: ChartBar[]) {
  const closes = bars.map((b) => b.close);
  return {
    ema9: emaSeries(closes, 9),
    bb: bollingerSeries(closes, 20, 2),
    rsi14: rsiSeries(closes, 14),
  };
}
