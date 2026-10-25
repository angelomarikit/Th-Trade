import { isUsEquityRthNow } from "./regularSession";

/** Which lab/mock query params to send — live RTH uses normal setup for speed and real signals. */
export function resolveLabScanFlags(
  input: {
    wuluLabModeEnabled: boolean;
    labTestDataMode: boolean;
    mockTradingMode: boolean;
    mockLiveRthMode: boolean;
    /** Test hook — defaults to now. */
    now?: Date;
  },
): {
  lab: boolean;
  mockRth: boolean;
  mockEnter: boolean;
  liveRthNow: boolean;
} {
  const liveRthNow = isUsEquityRthNow(input.now);
  const labOk = input.wuluLabModeEnabled;
  if (!labOk) {
    return { lab: false, mockRth: false, mockEnter: false, liveRthNow };
  }
  // Lab test data is for off-RTH only (Settings copy). During live RTH → real setup.
  const labTestScan = input.labTestDataMode && !liveRthNow;
  const mockSim = input.mockTradingMode && input.mockLiveRthMode && !liveRthNow;
  const lab = labTestScan || mockSim;
  const mockRth = mockSim;
  const mockEnter = mockRth && input.mockTradingMode;
  return { lab, mockRth, mockEnter, liveRthNow };
}
