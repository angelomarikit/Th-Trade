import { describe, expect, it } from "vitest";
import { resolveLabScanFlags } from "../src/lib/labScanFlags";

/** Fri 2026-10-23 15:00 ET (during RTH). */
const RTH_FRIDAY = new Date("2026-10-23T19:00:00.000Z");
/** Sat 2026-10-24 12:00 ET (closed). */
const SATURDAY = new Date("2026-10-24T16:00:00.000Z");

describe("resolveLabScanFlags", () => {
  it("uses live setup during RTH even when lab toggles are on", () => {
    const flags = resolveLabScanFlags({
      wuluLabModeEnabled: true,
      labTestDataMode: true,
      mockTradingMode: true,
      mockLiveRthMode: true,
      now: RTH_FRIDAY,
    });
    expect(flags.liveRthNow).toBe(true);
    expect(flags.lab).toBe(false);
    expect(flags.mockRth).toBe(false);
  });

  it("allows off-hours lab test when lab enabled", () => {
    const flags = resolveLabScanFlags({
      wuluLabModeEnabled: true,
      labTestDataMode: true,
      mockTradingMode: false,
      mockLiveRthMode: false,
      now: SATURDAY,
    });
    expect(flags.liveRthNow).toBe(false);
    expect(flags.lab).toBe(true);
  });
});
