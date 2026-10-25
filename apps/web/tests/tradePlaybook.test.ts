import { describe, expect, it } from "vitest";
import { buildTradePlaybook } from "../src/lib/tradePlaybook";

describe("buildTradePlaybook", () => {
  it("includes zone and do-now for WAIT", () => {
    const pb = buildTradePlaybook({
      symbol: "NVDA",
      side: "LONG",
      displayAction: "WAIT",
      displayPrice: 211,
      liveCard: {
        status: "WAIT",
        alertAt: 212,
        entryZone: { low: 211.5, high: 212.5, executable: false },
        stop: 210,
        t1: 215,
        t2: 218,
        lastPrice: 211,
        dataFresh: true,
        waitingFor: ["Waiting for 5m confirmation"],
        matrixChecklist: [
          {
            id: "VWAP",
            label: "VWAP",
            status: "WAITING",
            requiredForEntry: true,
            reason: "Below VWAP",
          },
        ],
      } as never,
    });
    expect(pb.whyThisZone).toContain("212");
    expect(pb.doNow).toContain("Below VWAP");
    expect(pb.gatesBlocking.length).toBe(1);
  });
});
