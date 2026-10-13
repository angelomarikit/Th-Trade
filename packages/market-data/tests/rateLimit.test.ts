import { describe, expect, it, vi } from "vitest";
import {
  AlpacaRequestGate,
  fetchAlpacaWithRetry,
  parseRetryAfterMs,
  resetSharedAlpacaGate,
} from "../src/rateLimit.js";
import { AlpacaMarketDataProvider } from "../src/providers/alpaca.js";

describe("Alpaca request pacing", () => {
  it("runs interactive lane before queued background work", async () => {
    const gate = new AlpacaRequestGate({
      minIntervalMs: 0,
      sleep: async () => undefined,
    });
    const order: number[] = [];
    let releaseFirst: () => void = () => undefined;
    const firstBlocked = new Promise<void>((r) => {
      releaseFirst = r;
    });
    const p1 = gate.schedule(async () => {
      order.push(1);
      await firstBlocked;
      return 1;
    }, "background");
    await Promise.resolve();
    const p2 = gate.schedule(async () => {
      order.push(2);
      return 2;
    }, "background");
    const p3 = gate.schedule(async () => {
      order.push(3);
      return 3;
    }, "interactive");
    releaseFirst();
    await Promise.all([p1, p2, p3]);
    expect(order).toEqual([1, 3, 2]);
  });

  it("spaces scheduled calls by minIntervalMs", async () => {
    let now = 1_000_000;
    const sleeps: number[] = [];
    const gate = new AlpacaRequestGate({
      minIntervalMs: 100,
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    });

    const starts: number[] = [];
    await Promise.all([
      gate.schedule(async () => {
        starts.push(now);
        now += 1;
        return 1;
      }),
      gate.schedule(async () => {
        starts.push(now);
        now += 1;
        return 2;
      }),
      gate.schedule(async () => {
        starts.push(now);
        now += 1;
        return 3;
      }),
    ]);

    expect(starts).toHaveLength(3);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(100);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(100);
    // Work advances the fake clock by 1ms, so paced waits are ~99ms+
    expect(sleeps.some((s) => s >= 90)).toBe(true);
  });

  it("parses Retry-After seconds", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(parseRetryAfterMs(null)).toBeNull();
  });

  it("retries HTTP 429 then succeeds", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls < 3) {
        return new Response(JSON.stringify({ message: "too many requests" }), {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const gate = new AlpacaRequestGate({
      minIntervalMs: 0,
      sleep: async () => undefined,
    });
    const res = await fetchAlpacaWithRetry(fetchImpl, "https://example.test", {}, {
      gate,
      maxRetries: 4,
      sleep: async () => undefined,
    });
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
  });

  it("fails after exhausting 429 retries", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "too many requests" }), {
        status: 429,
        headers: { "retry-after": "0" },
      });
    const gate = new AlpacaRequestGate({ minIntervalMs: 0, sleep: async () => undefined });
    await expect(
      fetchAlpacaWithRetry(fetchImpl, "https://example.test", {}, {
        gate,
        maxRetries: 2,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow(/HTTP 429/);
  });

  it("getSnapshot does not fire four parallel HTTP calls", async () => {
    resetSharedAlpacaGate({ minIntervalMs: 0, sleep: async () => undefined });
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl: typeof fetch = async (input) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      const url = String(input);
      if (url.includes("/quotes/latest")) {
        return json({ quote: { t: new Date().toISOString(), bp: 10, ap: 10.1, bs: 1, as: 1 } });
      }
      if (url.includes("/trades/latest")) {
        return json({ trade: { p: 10.05, t: new Date().toISOString() } });
      }
      if (url.includes("/bars")) {
        return json({
          bars: [
            {
              t: new Date(Date.now() - 60_000).toISOString(),
              o: 10,
              h: 11,
              l: 9,
              c: 10.05,
              v: 1000,
              vw: 10,
            },
          ],
        });
      }
      return json({});
    };

    const provider = new AlpacaMarketDataProvider({
      apiKeyId: "k",
      apiSecretKey: "s",
      fetchImpl,
      requestGate: new AlpacaRequestGate({ minIntervalMs: 0, sleep: async () => undefined }),
      maxRetries: 0,
    });

    await provider.getSnapshot("NVDA");
    expect(maxInFlight).toBe(1);
  });

  it("getSnapshots batches quotes + multi bars (few HTTP calls)", async () => {
    resetSharedAlpacaGate({ minIntervalMs: 0, sleep: async () => undefined });
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/snapshots")) {
        return json({
          AAA: {
            latestQuote: { t: new Date().toISOString(), bp: 10, ap: 10.1 },
            latestTrade: { p: 10.05, t: new Date().toISOString() },
          },
          BBB: {
            latestQuote: { t: new Date().toISOString(), bp: 20, ap: 20.1 },
            latestTrade: { p: 20.05, t: new Date().toISOString() },
          },
        });
      }
      if (url.includes("/v2/stocks/bars")) {
        return json({
          bars: {
            AAA: [
              {
                t: new Date(Date.now() - 60_000).toISOString(),
                o: 10,
                h: 11,
                l: 9,
                c: 10.05,
                v: 1000,
                vw: 10,
              },
            ],
            BBB: [
              {
                t: new Date(Date.now() - 60_000).toISOString(),
                o: 20,
                h: 21,
                l: 19,
                c: 20.05,
                v: 2000,
                vw: 20,
              },
            ],
          },
        });
      }
      return json({});
    };

    const provider = new AlpacaMarketDataProvider({
      apiKeyId: "k",
      apiSecretKey: "s",
      fetchImpl,
      requestGate: new AlpacaRequestGate({ minIntervalMs: 0, sleep: async () => undefined }),
      maxRetries: 0,
    });

    const snaps = await provider.getSnapshots(["AAA", "BBB"]);
    expect(snaps).toHaveLength(2);
    // 1 snapshots + 2 multi-bar timeframes (not 2×4 per-symbol)
    expect(urls.length).toBeLessThanOrEqual(4);
    expect(urls.some((u) => u.includes("/snapshots"))).toBe(true);
    expect(urls.filter((u) => u.includes("/v2/stocks/bars")).length).toBe(2);
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
