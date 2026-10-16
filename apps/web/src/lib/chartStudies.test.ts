import { describe, expect, it } from "vitest";
import { emaSeries, rsiSeries } from "./chartStudies";

describe("chartStudies", () => {
  it("computes EMA and RSI on simple closes", () => {
    const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const ema = emaSeries(closes, 9);
    expect(ema.at(-1)).not.toBeNull();
    const rsi = rsiSeries(closes, 14);
    expect(rsi.at(-1)).toBeGreaterThan(50);
  });
});
