/**
 * Process-wide Alpaca HTTP pacing + 429 retry helpers.
 * Shared by market-data calls so monitor multi-symbol scans do not burst the free/IEX limits.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type AlpacaRequestLane = "interactive" | "background";

const alpacaLaneStore = new AsyncLocalStorage<AlpacaRequestLane>();

let lastInteractiveAt = 0;

export function touchInteractiveAlpaca(): void {
  lastInteractiveAt = Date.now();
}

/** True while a user chart/setup request recently used Alpaca — monitor should yield. */
export function backgroundAlpacaShouldWait(windowMs = 20_000): boolean {
  return Date.now() - lastInteractiveAt < windowMs;
}

/** User-facing API routes (charts, setup) — scheduled ahead of background monitor work. */
export function withAlpacaPriority<T>(
  lane: AlpacaRequestLane,
  fn: () => Promise<T>,
): Promise<T> {
  return alpacaLaneStore.run(lane, fn);
}

function laneFromStore(): AlpacaRequestLane {
  return alpacaLaneStore.getStore() ?? "background";
}

export interface AlpacaRequestGateOptions {
  /** Minimum spacing between request starts (default 350ms ≈ ~170 req/min). */
  minIntervalMs?: number;
  maxRetries?: number;
  maxBackoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const DEFAULT_MIN_INTERVAL_MS = 350;
const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_MAX_BACKOFF_MS = 15_000;

type QueuedJob<T> = {
  lane: AlpacaRequestLane;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

export class AlpacaRequestGate {
  private interactiveQueue: QueuedJob<unknown>[] = [];
  private backgroundQueue: QueuedJob<unknown>[] = [];
  private draining = false;
  private lastStartAt = 0;
  private readonly minIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(opts?: AlpacaRequestGateOptions) {
    this.minIntervalMs = Math.max(0, opts?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS);
    this.sleep = opts?.sleep ?? defaultSleep;
    this.now = opts?.now ?? Date.now;
  }

  /** Serialize work and enforce min spacing between starts. */
  schedule<T>(fn: () => Promise<T>, lane: AlpacaRequestLane = "background"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const job: QueuedJob<T> = { lane, run: fn, resolve, reject };
      if (lane === "interactive") {
        this.interactiveQueue.push(job as QueuedJob<unknown>);
      } else {
        this.backgroundQueue.push(job as QueuedJob<unknown>);
      }
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.interactiveQueue.length > 0 || this.backgroundQueue.length > 0) {
        const job = this.interactiveQueue.shift() ?? this.backgroundQueue.shift();
        if (!job) break;
        const elapsed = this.now() - this.lastStartAt;
        const wait = Math.max(0, this.minIntervalMs - elapsed);
        if (wait > 0) await this.sleep(wait);
        this.lastStartAt = this.now();
        try {
          job.resolve(await job.run());
        } catch (err) {
          job.reject(err);
        }
      }
    } finally {
      this.draining = false;
      if (this.interactiveQueue.length > 0 || this.backgroundQueue.length > 0) {
        void this.drain();
      }
    }
  }
}

/** Singleton used by AlpacaMarketDataProvider (overridable in tests). */
let sharedGate: AlpacaRequestGate | null = null;

export function getSharedAlpacaGate(opts?: AlpacaRequestGateOptions): AlpacaRequestGate {
  if (!sharedGate) {
    sharedGate = new AlpacaRequestGate(opts ?? gateOptsFromEnv());
  }
  return sharedGate;
}

/** Test helper — reset singleton between cases. */
export function resetSharedAlpacaGate(opts?: AlpacaRequestGateOptions): AlpacaRequestGate {
  sharedGate = new AlpacaRequestGate(opts ?? gateOptsFromEnv());
  return sharedGate;
}

export function gateOptsFromEnv(env: NodeJS.ProcessEnv = process.env): AlpacaRequestGateOptions {
  const min = Number(env.ALPACA_MIN_REQUEST_INTERVAL_MS ?? DEFAULT_MIN_INTERVAL_MS);
  const retries = Number(env.ALPACA_MAX_RETRIES ?? DEFAULT_MAX_RETRIES);
  return {
    minIntervalMs: Number.isFinite(min) && min >= 0 ? min : DEFAULT_MIN_INTERVAL_MS,
    maxRetries: Number.isFinite(retries) && retries >= 0 ? Math.floor(retries) : DEFAULT_MAX_RETRIES,
    maxBackoffMs: DEFAULT_MAX_BACKOFF_MS,
  };
}

/** In-flight GET dedupe — concurrent identical URLs share one network call. */
const inflightGets = new Map<string, Promise<Response>>();

export async function fetchAlpacaWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  opts?: {
    gate?: AlpacaRequestGate;
    maxRetries?: number;
    maxBackoffMs?: number;
    sleep?: (ms: number) => Promise<void>;
    timeoutMs?: number;
  },
): Promise<Response> {
  const gate = opts?.gate ?? getSharedAlpacaGate();
  const maxRetries = opts?.maxRetries ?? gateOptsFromEnv().maxRetries ?? DEFAULT_MAX_RETRIES;
  const maxBackoffMs = opts?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  const sleep = opts?.sleep ?? defaultSleep;
  const timeoutMs = opts?.timeoutMs ?? Number(process.env.ALPACA_REQUEST_TIMEOUT_MS ?? 12_000);

  const lane = laneFromStore();
  if (lane === "interactive") touchInteractiveAlpaca();
  // Chart/setup calls fail once and free the queue. Background monitor keeps full retries.
  const attempts = lane === "interactive" ? Math.min(maxRetries, 1) : maxRetries;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= attempts; attempt++) {
    const res = await gate.schedule(
      () => dedupedGet(fetchImpl, url, init, Number.isFinite(timeoutMs) ? timeoutMs : 12_000),
      lane,
    );
    if (res.status !== 429 && res.status !== 503) {
      return res;
    }
    const bodyPreview = await res
      .clone()
      .text()
      .then((t) => t.slice(0, 120))
      .catch(() => "");
    lastError = new Error(`Alpaca market data HTTP ${res.status}: ${bodyPreview}`);
    if (attempt >= attempts) break;

    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
    const backoff = Math.min(
      maxBackoffMs,
      retryAfterMs ?? Math.round(500 * 2 ** attempt + Math.random() * 200),
    );
    await sleep(backoff);
  }
  throw lastError ?? new Error("Alpaca market data request failed after retries");
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header?.trim()) return null;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) {
    // HTTP Retry-After seconds (or already ms if unusually large — treat < 1000 as seconds)
    return asInt >= 1000 ? asInt : asInt * 1000;
  }
  const when = Date.parse(header);
  if (!Number.isNaN(when)) {
    return Math.max(0, when - Date.now());
  }
  return null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dedupedGet(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    return timedFetch(fetchImpl, url, init, timeoutMs);
  }
  const existing = inflightGets.get(url);
  if (existing) {
    const shared = await existing;
    return shared.clone();
  }
  const pending = timedFetch(fetchImpl, url, init, timeoutMs).finally(() => {
    inflightGets.delete(url);
  });
  inflightGets.set(url, pending);
  const res = await pending;
  return res.clone();
}

async function timedFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  if (!timeoutMs || timeoutMs <= 0) {
    return fetchImpl(url, init);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: ac.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Alpaca market data timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Test helper */
export function clearInflightAlpacaGets(): void {
  inflightGets.clear();
}
