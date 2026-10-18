import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CHART_OVERLAYS,
  readJson,
  STORAGE_KEYS,
  writeJson,
  type ChartOverlayPrefs,
} from "../src/lib/storage";

describe("chartOverlays storage", () => {
  const mem = new Map<string, string>();

  beforeEach(() => {
    mem.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
      clear: () => {
        mem.clear();
      },
    });
  });

  it("persists independent toggles under wulu.v2.chartOverlays", () => {
    const prefs: ChartOverlayPrefs = { vwap: true, ema: true, bb: false, rsi: false };
    writeJson(STORAGE_KEYS.chartOverlays, prefs);
    expect(readJson(STORAGE_KEYS.chartOverlays, DEFAULT_CHART_OVERLAYS)).toEqual(prefs);
  });

  it("defaults all overlays on when key missing", () => {
    expect(readJson(STORAGE_KEYS.chartOverlays, DEFAULT_CHART_OVERLAYS)).toEqual(DEFAULT_CHART_OVERLAYS);
  });
});
