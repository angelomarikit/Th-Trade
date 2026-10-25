import { describe, expect, it } from "vitest";
import { mockTapeIntervalMs, tickSimulatedPrice } from "../src/lib/mockLiveTape";

describe("mockLiveTape", () => {
  it("uses RTH bar period for 1m cadence", () => {
    expect(mockTapeIntervalMs("1m")).toBe(60_000);
    expect(mockTapeIntervalMs("5m")).toBe(300_000);
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
