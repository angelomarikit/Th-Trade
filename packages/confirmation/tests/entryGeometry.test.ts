import { describe, expect, it } from "vitest";
import { describeEntryGeometry } from "../src/entryGeometry.js";

describe("entryGeometry", () => {
  it("labels MU-style price above zone as no chase", () => {
    const g = describeEntryGeometry(
      "LONG",
      {
        side: "LONG",
        trigger: 913.23,
        entryZoneLow: 913.23,
        entryZoneHigh: 916,
        stop: 902,
        target1: 939,
        target2: 950,
      },
      926.02,
      "WAIT",
    );
    expect(g.kind).toBe("ABOVE_ZONE_NO_CHASE");
    expect(g.summary).toMatch(/above the entry zone/i);
  });
});
