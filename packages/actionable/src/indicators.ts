import type { Bar } from "@wulu/market-data";

export function completed(bars: Bar[]): Bar[] {
  return bars.filter((b) => b.completed);
}

export function closes(bars: Bar[]): number[] {
  return completed(bars).map((b) => b.close);
}

export function emaSeries(values: number[], period: number): (number | null)[] {
  if (values.length < period) return values.map(() => null);
  const k = 2 / (period + 1);
  const out: (number | null)[] = values.map(() => null);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function lastEma(values: number[], period: number): number | null {
  const s = emaSeries(values, period);
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] != null) return s[i];
  }
  return null;
}

export function emaAt(values: number[], period: number, index: number): number | null {
  const s = emaSeries(values, period);
  return s[index] ?? null;
}

export function atrAbs(bars: Bar[], period = 14): number | null {
  const c = completed(bars);
  if (c.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < c.length; i++) {
    const cur = c[i]!;
    const prev = c[i - 1]!;
    trs.push(
      Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close)),
    );
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  if (values.length <= period) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** Wilder ADX(14) on completed daily bars. */
export function adx(bars: Bar[], period = 14): number | null {
  const c = completed(bars);
  if (c.length < period * 2) return null;
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < c.length; i++) {
    const up = c[i]!.high - c[i - 1]!.high;
    const down = c[i - 1]!.low - c[i]!.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
    tr.push(
      Math.max(
        c[i]!.high - c[i]!.low,
        Math.abs(c[i]!.high - c[i - 1]!.close),
        Math.abs(c[i]!.low - c[i - 1]!.close),
      ),
    );
  }
  let atrW = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let plusW = plusDm.slice(0, period).reduce((a, b) => a + b, 0);
  let minusW = minusDm.slice(0, period).reduce((a, b) => a + b, 0);
  const dxs: number[] = [];
  for (let i = period; i < tr.length; i++) {
    atrW = atrW - atrW / period + tr[i]!;
    plusW = plusW - plusW / period + plusDm[i]!;
    minusW = minusW - minusW / period + minusDm[i]!;
    const pdi = atrW === 0 ? 0 : (100 * plusW) / atrW;
    const mdi = atrW === 0 ? 0 : (100 * minusW) / atrW;
    const sum = pdi + mdi;
    dxs.push(sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum);
  }
  if (dxs.length < period) return null;
  return dxs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export function rising(values: number[], lookback: number): boolean {
  if (values.length < lookback + 1) return false;
  const slice = values.slice(-lookback - 1);
  return slice[slice.length - 1]! > slice[0]!;
}

export function avgVolume(bars: Bar[], lookback: number, excludeLast = 0): number | null {
  const c = completed(bars);
  const end = c.length - excludeLast;
  if (end < lookback) return null;
  const slice = c.slice(end - lookback, end);
  return slice.reduce((a, b) => a + b.volume, 0) / slice.length;
}
