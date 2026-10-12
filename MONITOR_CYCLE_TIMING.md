# Monitor cycle timing vs five-minute strategy

**Observed (6 symbols, IEX, paced Alpaca gate):** hub `lastCycleMs` ≈ **39–40s** (sometimes higher under load).  
**Configured interval:** `MONITOR_INTERVAL_MS` default **20_000** (20s).  
**Effective cadence:** ≈ `max(interval, lastCycleMs)` because overlapping ticks are blocked (`ticking` guard).

## Is ~40s fast enough for 5-minute bars?

| Metric | Value |
|--------|--------|
| 5m candle length | 300s |
| Samples per candle at 40s | ~7–8 |
| Completed-candle confirmation | Evaluated only on **completed** bars — not mid-forming ticks |

**Verdict:** For a **completed five-minute confirmation** model, **~40s is acceptable** for 6 symbols. We do not confirm on unfinished candles, so sub-5s polling does not create earlier valid ENTRY ACTIVE.

## Scaling guidance

| Unique (symbol, side) pairs | Rough cycle (IEX pacing ~350ms+) | Guidance |
|-----------------------------|----------------------------------|----------|
| 6 | ~40s | OK |
| 12–20 | ~1–2 min | Still OK for 5m; watch freshness |
| 30+ | May exceed 2–3 min | Raise `MONITOR_MAX_SYMBOLS` carefully or add concurrency pools / paid data |

Prefer keeping **fail-closed freshness** over speeding cycles into 429 storms.

## Recommendation

Do **not** lower confirmation quality to chase faster scans. If cycle regularly exceeds **90s**, optimize batching/caching first; only then consider a modest interval tweak.
