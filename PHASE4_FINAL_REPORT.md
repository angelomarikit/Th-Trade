# Phase 4 — Final completion report

**Trading date (ET):** Monday **2026-10-12** (RTH)  
**Operator local (UTC+8):** Tuesday 2026-10-13 morning — reports use **ET trading date**.  
**Production tip on `main`:** `063d2a4`  
**Railway:** deployment `e3a7a747` **SUCCESS** (2026-10-13 03:20 +08) — hub cycle ~40s, 6 pairs, 0 failed scans, `automaticOrders=false`  
**Note:** `railway up` from source may leave `/health.gitCommit` null; code matches tip `063d2a4` on `main`.  
**UI:** https://web-tawny-iota-56.vercel.app (Vercel from `main`, includes ET timestamps)  
**Auto-trading:** **disabled**

## Summary

Phase 4 durable history, outcome tracking, alert restart safety, R:R geometry, ET timestamps, and live-history flood control are in place. Automatic trading stays off. No published win-rate claims.

| Item | Status |
|------|--------|
| Tests | **81 / 81** passed |
| Open-signal restart survival | **Working** via `signal_performance_records` `track:*` mirrors (entry/stop/targets/status) |
| Dedicated `open_signal_tracks` + `monitor_alert_dedupe` tables | **SQL ready** — not yet in project schema cache (apply `20261013_phase4_open_tracks.sql`) |
| Alert dedupe after restart | **Working** — seeds from `monitor_alert_events.dedupe_key` when dedicated table missing |
| ET timestamps on watchlist | **Shipped** (`formatEtTime`) on `a86adb3` / `main` |
| R:R geometry (SPY 0.01) | **Fixed** — T1 beyond entry; still blocks below 2R |
| Historical lifecycle WAIT→ENTRY→HIT_T1 | **Proven & saved** in Supabase as `HISTORICAL_REPLAY` |
| Live ENTRY ACTIVE soak | **Still pending** — gates unchanged; no forced trades |
| Live history duplicates | **Root cause fixed** — `SignalPersistGate` (state / 5m bar transitions only) |

## What was tested

### 1. Supabase permanence

- `signal_performance_records`: **~10.2k+** rows (service role writes OK).
- Open-track **mirrors** (`track:*`) hydrate after Railway restart (verified earlier + lifecycle script).
- Alert events: **36+** durable rows; dedupe seeds from events when `monitor_alert_dedupe` absent.
- **Operator action still required:** paste/run  
  `supabase/migrations/20261013_phase4_open_tracks.sql`  
  in Supabase SQL editor (dashboard login needed from this environment), **or** set `SUPABASE_DB_URL` and run `node scripts/apply-phase4-migration.mjs`.

### 2. Deploy

| Surface | Commit / note |
|---------|----------------|
| GitHub `main` | `063d2a4` |
| Railway API | `e3a7a747` SUCCESS · cycle ~40s · auto off |
| Vercel web | Auto-deploy from `main` (includes ET card timestamps) |

### 3. Full signal lifecycle (historical)

Script: `scripts/phase4-lifecycle-persist.mjs`

| Step | Result |
|------|--------|
| WAIT | Saved `REPLAY:LONG:100.0000:…` · `HISTORICAL_REPLAY` |
| ENTRY ACTIVE | Open track `track:HISTORICAL_REPLAY:anon:REPLAY:LONG:100.0000` |
| HIT_T1 | Outcome **WIN** · R ≈ 1.5 · `liveValidated=false` |

Live IEX `/v1/replay` on TSLA/NVDA/AMD/SPY/QQQ/MU (120 bars): **all NO_TRADE** — expected under current RTH gates (R:R, VWAP, volume, structure). Replay does **not** lower safety rules.

### 4. 10,000+ record audit

| Finding | Detail |
|---------|--------|
| Cause | Every monitor tick (~40–70s) wrote a unique LIVE row (`setupId:evaluatedAt`) |
| Scale | ~10k LIVE rows / 24h window; SPY alone ~1.7k |
| Risk | Storage growth + noisy history as users scale |
| Fix | `SignalPersistGate` — persist only on **state change**, **new completed 5m bar** while WAIT/NEAR/ENTRY, or **open/resolve** |
| Cleanup | Old tick rows left in place (no mass delete). New growth rate should drop to ~transitions + bar advances |

### 5. Scanner speed

| Metric | Observation |
|--------|-------------|
| Interval config | 20s |
| Steady 6-symbol cycle | Historically **~39–40s**; post-redeploy often **60–80s+** until warm |
| Fit for 5m strategy | **Yes** — confirmation is on **completed** 5m bars (~7–8 samples/candle at 40s) |
| Alerts | State-change events only; restart-safe dedupe |

See `MONITOR_CYCLE_TIMING.md`.

### 6. Live RTH ENTRY ACTIVE

Not captured this pass. Discipline held: **no gate lowering**. Continue soaking next US session for WAIT → confirmation → ENTRY → stop/T1.

## Production commits (Phase 4 arc)

| Commit | Role |
|--------|------|
| `91137ac` | Level geometry (T1 beyond entry) + open-track mirrors |
| `a86adb3` | Watchlist ET timestamps |
| `da69eda` | Live history gate + replay openTracks + lifecycle script |
| `063d2a4` | Persist-gate TypeScript fix (`timestamp`) — Railway build green |

## Remaining attention

1. **Apply** `20261013_phase4_open_tracks.sql` in Supabase (dedicated tables).
2. Optionally set Railway GitHub commit metadata so `/health.gitCommit` is non-null.
3. Capture a **real** live ENTRY ACTIVE → outcome without relaxing rules.
4. Optional: archive/prune pre-gate LIVE tick spam once comfortable.
5. Keep auto-trading **off**; do not publish win rates from hypothetical replay.

## Phase 5 readiness

Phase 4 foundation (history, outcomes, alerts, geometry, ET, flood control) is ready to build on. Phase 5 focus: advanced market intelligence, news catalysts, stronger filtering, and ranking best opportunities across the market — still signals-only.
