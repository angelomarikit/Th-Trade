import type { Bar } from "@wulu/market-data";
import { averageVolume, lastCompletedBar, relativeVolume } from "@wulu/market-data";

export interface VolumeResult {
  pass: boolean;
  waiting: boolean;
  relativeVolume: number | null;
  reason: string;
}

export function evaluateVolumeConfirmation(
  bars5m: Bar[],
  minRelativeVolume = 1.2,
): VolumeResult {
  const completed = bars5m.filter((b) => b.completed);
  if (completed.length < 6) {
    return {
      pass: false,
      waiting: true,
      relativeVolume: null,
      reason: "Waiting for volume confirmation (insufficient completed bars)",
    };
  }

  const last = lastCompletedBar(bars5m)!;
  const baseline = completed.slice(0, -1);
  const rvol = relativeVolume([last], baseline, 1);
  const avg = averageVolume(baseline, baseline.length);

  if (rvol == null || avg == null) {
    return {
      pass: false,
      waiting: true,
      relativeVolume: null,
      reason: "Waiting for volume confirmation",
    };
  }

  if (rvol >= minRelativeVolume) {
    return {
      pass: true,
      waiting: false,
      relativeVolume: rvol,
      reason: `Relative volume PASS: ${rvol.toFixed(2)}x >= ${minRelativeVolume}x`,
    };
  }

  return {
    pass: false,
    waiting: true,
    relativeVolume: rvol,
    reason: `Waiting for volume confirmation (RVOL ${rvol.toFixed(2)}x < ${minRelativeVolume}x)`,
  };
}
