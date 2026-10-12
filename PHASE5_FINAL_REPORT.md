# Phase 5 — Final validation report

**Trading clock at test:** Monday **2026-10-12** · **17:40 ET** · session **AFTERHOURS**  
**Production tip:** ranking quality fix shipping with this report (base discovery deploy `e260fa2`)  
**Auto-trading:** disabled · **min 2R:** unchanged · **Alpaca:** Basic / IEX (no paid upgrade)

## Verdict

Phase 5 discovery is **working in production** and confirmation correctly **refuses ENTRY** from rank alone. Full RTH freshness / 12-symbol promote soak was **not available this window** (after close). Ready to proceed to **Phase 6 offline work** while one US RTH session completes the remaining checklist below.

| Gate | Result |
|------|--------|
| Discovery scan ~95 names | **PASS** — ~5.9s discovery-only; prices/scores returned |
| Rank ≠ ENTRY ACTIVE | **PASS** — confirm top-3×2 → all `DATA_NOT_VERIFIED`, **0** ENTRY ACTIVE |
| Fail-closed after hours | **PASS** — `dataFresh=false`, stale → no actionable signals |
| Monitor load (observed) | **PASS** at **6** pairs · **0** failed scans · cycle **~54–125s** (AH slower) |
| 12-symbol promote + alerts | **Deferred to next RTH** (monitor mutate APIs require auth) |
| Ranking quality | **Issue found + fixed** — was overweighting raw day% movers |

## What was tested (live production)

### 1. Discovery data & rankings

| Metric | Value |
|--------|-------|
| Universe / scanned | 95 / 95 |
| Discovery-only latency | **5.9s** server (`elapsedMs`) / ~6.4s wall |
| With `confirm=3` (6 deep scans) | ~165s (expected — full `getSnapshot` per name) |
| Feed | IEX |
| Sample LONG leaders (AH) | META, SHOP, CRM… with vs-SPY + RVOL fields populated |
| Sample SHORT leaders | MU, SOFI, SMCI… |

Timestamps on TopBar/setup use ET; after-hours correctly labeled **Mon 17:40 ET**. Card data freshness correctly **false** outside RTH.

### 2. Promote → confirmation (rank never grants entry)

`GET /v1/opportunities?top=10&confirm=3` ran existing `evaluateSetup` on top LONG and SHORT picks:

| Side | Symbol | Discovery score | Confirmed state | R:R |
|------|--------|-----------------|-----------------|-----|
| LONG | META | 100 | DATA_NOT_VERIFIED | 0.60 |
| LONG | SHOP | 94 | DATA_NOT_VERIFIED | 0.50 |
| LONG | CRM | 90 | DATA_NOT_VERIFIED | 2.67 |
| SHORT | MU | 93 | DATA_NOT_VERIFIED | 0.57 |
| SHORT | SOFI | 93 | DATA_NOT_VERIFIED | 0.50 |
| SHORT | SMCI | 91 | DATA_NOT_VERIFIED | 0.51 |

**entry_from_confirm_count = 0** — high discovery rank did **not** create ENTRY ACTIVE. CRM showing R:R &gt; 2 still blocked by freshness / other gates (correct).

### 3. Monitor responsiveness (6 pairs observed)

| Tick | cycleMs | failed | pairs |
|------|---------|--------|-------|
| 32 | 123932 | 0 | 6 |
| 33 | 125048 | 0 | 6 |
| 34 | 84096 | 0 | 6 |

Earlier health sample same process: **cycleMs ≈ 53662**, failed **0**. No 429 failures observed. Alert event listing requires auth (401) — cannot measure alert delay unauthenticated; dedupe table remains populated from prior RTH.

**12-symbol load:** `POST /v1/monitor/defaults` and promote return **401** without session. Hub `maxSymbols=12` is configured; operator should promote top-5 LONG + top-5 SHORT during next RTH and re-check `health.monitor.lastCycleMs` / `failedScansLastCycle`.

### 4. Ranking quality finding → fix

**Problem:** Scores could climb to 100 largely from large day% / vs-SPY even when RVOL was mediocre (e.g. COP ~0.86× still ranked high).

**Fix (deployed with this pass):** discovery scorer now:

- Weights **relative strength + sector + RVOL + spread** above raw day%
- Penalizes **big movers without volume / without relative edge**
- Soft-caps score at **78** unless rel-strength ≥ 0.5% and RVOL ≥ 1.3× and spread OK

Unit test added: mover-without-volume loses to quality relative-strength name.

## Problems discovered

1. **After-hours confirmation latency** — `confirm=N` pulls full snapshots; fine for occasional use, not for every discovery click. Keep default UI confirm low (0–3).
2. **AH monitor cycles slower** (~84–125s) than prior RTH ~40–54s — expect better in RTH; watch at 12 symbols.
3. **Authenticated promote path** — needed for full 12-symbol / alert-delay test (operator login).
4. **Mover bias in v1 scorer** — fixed as above.

## What was fixed this pass

- Discovery ranking quality (structure of score: relative volume, liquidity, relative/sector strength first)
- Tests for anti-mover-chasing behavior

## Remaining RTH checklist (next US session — ~1–2 hours, not days)

1. Open Opportunities during RTH · verify FEED OK / prices updating  
2. Run discovery · confirm top 3 · still **no** ENTRY from rank alone  
3. Promote ~10–12 names · measure cycleMs / failedScans / freshness  
4. Continue ENTRY ACTIVE → outcome soak (unchanged gates)

## Phase 6 readiness

**Yes for starting Phase 6 offline development** (intelligence / filtering / product polish as planned next).  
**Hold any claim of “fully RTH-validated Phase 5”** until the short checklist above is ticked once during regular hours.

No paid Alpaca upgrade indicated — Basic handled 95-name discovery in ~6s with 0 failed monitor scans at 6 pairs.
