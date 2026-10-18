import { describe, expect, it, vi } from "vitest";
import {
  isAlpacaMarketDataAuthError,
  marketDataAuthSoftFailEnabled,
  wrapMarketDataAuthSoftFail,
} from "../src/resilientMarketData.js";
import type { MarketDataProvider } from "../src/MarketDataProvider.js";

describe("resilientMarketData", () => {
  it("detects Alpaca 401/403 auth errors", () => {
    expect(isAlpacaMarketDataAuthError(new Error("Alpaca market data HTTP 401: html"))).toBe(true);
    expect(isAlpacaMarketDataAuthError(new Error("Alpaca market data HTTP 403: denied"))).toBe(true);
    expect(isAlpacaMarketDataAuthError(new Error("timeout"))).toBe(false);
  });

  it("defaults soft-fail on unless explicitly disabled", () => {
    expect(marketDataAuthSoftFailEnabled({})).toBe(true);
    expect(marketDataAuthSoftFailEnabled({ RAILWAY_PROJECT_ID: "abc" })).toBe(true);
    expect(marketDataAuthSoftFailEnabled({ MARKET_DATA_AUTH_SOFT_FAIL: "0" })).toBe(false);
    expect(marketDataAuthSoftFailEnabled({ MARKET_DATA_AUTH_SOFT_FAIL: "false" })).toBe(false);
  });

  it("getSnapshot returns empty snapshot on auth failure instead of throwing", async () => {
    const inner: MarketDataProvider = {
      name: "mock-inner",
      getQuote: vi.fn(),
      getBars: vi.fn(),
      getSnapshot: vi.fn(async () => {
        throw new Error("Alpaca market data HTTP 401: <html>");
      }),
    };
    const wrapped = wrapMarketDataAuthSoftFail(inner);
    const snap = await wrapped.getSnapshot("NVDA");
    expect(snap.symbol).toBe("NVDA");
    expect(snap.bars1m).toEqual([]);
    expect(snap.bars5m).toEqual([]);
  });
});
