import { describe, expect, it } from "vitest";
import { effectiveTradingAction } from "../src/lib/effectiveTradingAction";

describe("effectiveTradingAction", () => {
  it("blocks ENTER when lab authorized side differs", () => {
    expect(
      effectiveTradingAction(
        {
          side: "LONG",
          tradingAction: "ENTER",
          dataFresh: true,
          labMockEnterAuthorizedSide: "SHORT",
          mockEnter: false,
        } as never,
        "LONG",
      ),
    ).toBe("WAIT");
  });
});
