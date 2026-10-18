import { describe, expect, it } from "vitest";
import {
  clampVisibleLogicalRange,
  liveVisibleLogicalRange,
  RIGHT_OFFSET_BARS,
} from "../src/lib/chartViewport";

describe("chartViewport", () => {
  it("live range anchors to the latest bars with small right padding", () => {
    const barCount = 200;
    const live = liveVisibleLogicalRange(barCount);
    expect(live).not.toBeNull();
    expect(live!.to).toBe(barCount - 1 + RIGHT_OFFSET_BARS);
    expect(live!.from).toBe(barCount - 72);
  });

  it("clamps panned views inside data edges", () => {
    const barCount = 100;
    const maxTo = barCount - 1 + RIGHT_OFFSET_BARS;
    const clamped = clampVisibleLogicalRange(-50, maxTo + 40, barCount);
    expect(clamped).not.toBeNull();
    expect(clamped!.from as number).toBeGreaterThanOrEqual(0);
    expect(clamped!.to as number).toBeLessThanOrEqual(maxTo);
  });

  it("repairs inverted from/to (pinch glitch)", () => {
    const clamped = clampVisibleLogicalRange(90, 12, 120);
    expect(clamped).not.toBeNull();
    expect(clamped!.from as number).toBeLessThan(clamped!.to as number);
    expect(clamped!.to as number).toBe(120 - 1 + RIGHT_OFFSET_BARS);
  });

  it("Return to Live window matches clamp of the same from/to", () => {
    const barCount = 64;
    const live = liveVisibleLogicalRange(barCount)!;
    const clamped = clampVisibleLogicalRange(live.from, live.to, barCount);
    expect(clamped!.from).toBe(live.from as typeof clamped.from);
    expect(clamped!.to).toBe(live.to as typeof clamped.to);
  });
});
