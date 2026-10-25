import { describe, expect, it } from "vitest";
import { mockTapeIntervalMs, tickSimulatedPrice } from "../src/lib/mockLiveTape";

describe("mockLiveTape", () => {
  it("uses RTH bar period for 1m cadence when fast demo off", () => {
    expect(mockTapeIntervalMs("1m", false)).toBe(60_000);
    expect(mockTapeIntervalMs("5m", false)).toBe(300_000);
  });

  it("uses sub-second cadence when fast demo on", () => {
    expect(mockTapeIntervalMs("1m", true)).toBe(800);
    expect(mockTapeIntervalMs("5m", true)).toBe(800);
  });

  it("nudges price within a band around the anchor", () => {
    const anchor = 211.11;
    let px = anchor;
    for (let step = 1; step <= 40; step++) {
      px = tickSimulatedPrice({ symbol: "NVDA", step, prevClose: px, anchor });
      expect(px).toBeGreaterThan(anchor * 0.985);
      expect(px).toBeLessThan(anchor * 1.015);
    }
  });
});
