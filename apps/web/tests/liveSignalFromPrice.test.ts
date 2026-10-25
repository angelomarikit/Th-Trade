import { describe, expect, it } from "vitest";
import { enrichLiveCardWithChartPrice, liveSignalHeadline } from "../src/lib/liveSignalFromPrice";
import type { SetupLiveCard } from "../src/lib/api";

const base: SetupLiveCard = {
  headline: "NVDA",
  status: "SIM RTH · WAIT",
  whyMoving: "",
  catalyst: null,
  newsAgeMinutes: null,
  priceReaction: null,
  conditions: "5/7",
  alertAt: 100,
  waitingFor: [],
  entryZone: { low: 99, high: 101, executable: false },
  stop: 98,
  t1: 104,
  t2: 108,
  lastPrice: 99,
  nearActive: {
    active: true,
    distanceLabel: "1.00% BELOW TRIGGER",
    distanceToTriggerPct: -1,
    stillWaitingFor: ["5m confirmation"],
    conditionsPassed: 5,
    conditionsTotal: 7,
    confirmationRequirement: "",
    permissionToEnter: false,
    dataTimestamp: null,
    setupQualityScore: 5,
  },
};

describe("liveSignalFromPrice", () => {
  it("updates distance when chart price moves", () => {
    const next = enrichLiveCardWithChartPrice(base, 100);
    expect(next.nearActive?.distanceLabel).toBe("AT TRIGGER");
    expect(next.lastPrice).toBe(100);
  });

  it("headline includes live distance", () => {
    expect(
      liveSignalHeadline({
        status: "WAIT",
        tradingAction: "WAIT",
        distanceLabel: "AT TRIGGER",
        side: "LONG",
      }),
    ).toContain("AT TRIGGER");
  });
});
