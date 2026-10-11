import type { Bar } from "@wulu/market-data";

export interface CandleAnatomy {
  range: number;
  body: number;
  bodyRatio: number;
  upperWick: number;
  lowerWick: number;
  upperWickRatio: number;
  lowerWickRatio: number;
  bullish: boolean;
}

export function candleAnatomy(bar: Bar): CandleAnatomy {
  const range = Math.max(1e-9, bar.high - bar.low);
  const body = Math.abs(bar.close - bar.open);
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  return {
    range,
    body,
    bodyRatio: body / range,
    upperWick,
    lowerWick,
    upperWickRatio: upperWick / range,
    lowerWickRatio: lowerWick / range,
    bullish: bar.close >= bar.open,
  };
}
