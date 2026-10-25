import type { SetupResponse } from "./api";
import { readJson, writeJson } from "./storage";

const CACHE_KEY = "wulu.v2.lastSetupBySymbolSide";

type SetupCacheMap = Record<string, SetupResponse>;

function cacheKey(symbol: string, side: "LONG" | "SHORT"): string {
  return `${symbol.trim().toUpperCase()}:${side}`;
}

export function readCachedSetup(symbol: string, side: "LONG" | "SHORT"): SetupResponse | null {
  const map = readJson<SetupCacheMap>(CACHE_KEY, {});
  const hit = map[cacheKey(symbol, side)];
  return hit?.liveCard ? hit : null;
}

export function writeCachedSetup(symbol: string, side: "LONG" | "SHORT", setup: SetupResponse): void {
  if (!setup.liveCard) return;
  const map = readJson<SetupCacheMap>(CACHE_KEY, {});
  map[cacheKey(symbol, side)] = setup;
  writeJson(CACHE_KEY, map);
}
