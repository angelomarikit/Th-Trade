import { describe, expect, it } from "vitest";
import {
  calculatePositionSize,
  POSITION_SIZE_NOT_CALCULATED_MESSAGE,
} from "../src/risk.js";
import { isEntryActive, SETUP_STATES } from "../src/setup-state.js";

describe("domain risk", () => {
  it("refuses sizing without verified account value", () => {
    const r = calculatePositionSize({
      verifiedAccountValue: null,
      entryPrice: 100,
      stopPrice: 98,
    });
    expect(r.calculated).toBe(false);
    expect(r.message).toBe(POSITION_SIZE_NOT_CALCULATED_MESSAGE);
  });

  it("sizes at 2% risk", () => {
    const r = calculatePositionSize({
      verifiedAccountValue: 100_000,
      entryPrice: 100,
      stopPrice: 98,
    });
    expect(r.calculated).toBe(true);
    expect(r.dollarsAtRisk).toBe(2000);
    expect(r.shares).toBe(1000);
  });
});

describe("setup states", () => {
  it("includes NEAR_ACTIVE and does not treat it as entry", () => {
    expect(SETUP_STATES).toContain("NEAR_ACTIVE");
    expect(isEntryActive("NEAR_ACTIVE")).toBe(false);
    expect(isEntryActive("ENTRY_ACTIVE_LONG")).toBe(true);
  });
});
