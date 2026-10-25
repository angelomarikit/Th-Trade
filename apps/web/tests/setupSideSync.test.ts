import { describe, expect, it } from "vitest";
import { setupCardSide, setupMatchesSelectedSide } from "../src/lib/setupSideSync";

describe("setupSideSync", () => {
  it("matches liveCard side to toggle", () => {
    const data = {
      liveCard: { side: "SHORT" as const },
      card: { side: "LONG" as const },
    } as never;
    expect(setupCardSide(data)).toBe("SHORT");
    expect(setupMatchesSelectedSide(data, "SHORT")).toBe(true);
    expect(setupMatchesSelectedSide(data, "LONG")).toBe(false);
  });
});
