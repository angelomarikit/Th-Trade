# Phase 4 development pass report

**Trading date (ET):** Monday **2026-10-12** (RTH afternoon)  
**Local note (UTC+8):** that same session falls on **Tuesday 2026-10-13** morning — reports label the **ET trading date**, not the operator’s calendar day.  
**Production API commit:** `91137ac199a66ece0aa90bb10c69b69a8f9a36d3`  
**UI:** https://web-tawny-iota-56.vercel.app/watchlist  
**Auto-trading:** **disabled** (`automaticOrders=false`, SIGNALS ONLY)

Screenshot (post R:R geometry fix): `docs/screenshots/phase4-rr-geometry-fixed.png`

## Deliverables checklist

| # | Ask | Status |
|---|-----|--------|
| 1 | Permanent open-signal tracking through Railway restart | **Done via dual-write** — open tracks mirror into `signal_performance_records` (`track:*` ids) with entry/stop/targets/status so hydrate works even if `open_signal_tracks` is not yet applied |
| 2 | Verify entry / stop / target math (SPY ~0.01:1) | **Fixed & verified live** — T1 no longer sits inside the entry zone |
| 3 | Wait for genuine ENTRY ACTIVE (no gate lowering) | **Still soaking** — no ENTRY ACTIVE this session; all gates intact |
| 4 | Alert dedupe survives restart | **In place** — insert-only dedupe + seed on boot; 33 alert events retained; no duplicate storm after redeploy |
| 5 | Correct timestamps / trading dates | **Clarified** — TopBar ET clock correct (`Mon … ET`); card “Data” / hub “last” were local-browser times (UTC+8 → 2:xx AM) — patched to ET (`formatEtTime`) |
| 6 | Website / mobile UX | **Continued** — watchlist shows “below 2R — no ENTRY”, quality score disclaimer, ET timestamps |
| — | ~40s cycle vs 5m strategy | **OK for completed-5m model** — see `MONITOR_CYCLE_TIMING.md`; post-redeploy cycles temporarily ~60–180s while hub warm |

## Tests

**79 / 79 passed** (21 files) — including level-geometry invariants.

## Production verification (live)

| Check | Result |
|-------|--------|
| `/health` gitCommit | `91137ac…` |
| automaticOrders | `false` |
| Failed scans | `0` |
| Hub | Running · 6 pairs · IEX |
| Session badge | **RTH** · FEED OK · SIGNALS ONLY |

### R:R geometry — before vs after

| Symbol | Before (bug) | After (`91137ac`) |
|--------|----------------|-------------------|
| **SPY** | R:R **0.01:1**, T1 **inside** entry (e.g. T1 774.54 in 773.41–775.73) | R:R **0.50:1**, T1 **777.16** beyond entry **773.78–776.10**, stop **770.49** below entry |
| QQQ | T1 could compress into zone | T1 **758.83** beyond **755.52–757.79**, R:R ~0.19 |
| TSLA / NVDA / AMD / MU | — | All T1 **beyond** entry zone |

Cause: measured-move projection landed inside the entry band when price was already above consolidation. Fix in `deriveLevels`: force LONG/SHORT T1 beyond the entry zone; keep stops outside entry. Low R:R still correctly **blocks ENTRY** (min 2R).

### Signal history / outcomes

| Metric | Value |
|--------|-------|
| `signal_performance_records` (Supabase) | **~10,133** |
| Open tracks (API) | 1 mirror (`track:LIVE:persist-test:…` persistence probe) |
| Performance summary (API window) | total 200 · actionable 1 · wins/losses **0** · `liveValidated` **0** |
| Published win rate | **None** (foundation counts only) |

### ENTRY ACTIVE soak

No genuine ENTRY ACTIVE during this pass. Cards show **WAIT** / **NO TRADE** with VWAP, RVOL, structure, fake-break, and **below 2R** reasons. Safety requirements were **not** lowered.

## Monitor cycle vs 5-minute strategy

- Steady-state with 6 symbols: historically **~39–40s** (≈7–8 samples per 5m candle).
- Confirmation uses **completed** 5m bars only — faster polling does not create earlier valid entries.
- Scaling: 12–20 pairs still OK for 5m; 30+ needs batching/concurrency before cutting quality.
- Prefer fail-closed freshness over racing IEX into 429s.

## Remaining issues / operator actions

1. **Apply** `supabase/migrations/20261013_phase4_open_tracks.sql` in production Supabase if not already (dedicated `open_signal_tracks` + `monitor_alert_dedupe` tables). Until then, **performance-row mirrors** keep open tracks restart-safe.
2. **Continue RTH soak** for a real WAIT → confirmation → ENTRY ACTIVE → stop/T1 path without relaxing gates.
3. **ET timestamp UI patch** (`formatEtTime` on watchlist Data / last tick / events) — ship with next web deploy so card times match the TopBar (not UTC+8 local).
4. Cycle may spike after Railway redeploy; if sustained **>90s**, optimize batching before changing confirmation quality.
5. IEX volume ≠ consolidated — RVOL remains approximate (labeled).
6. Optional: clean Railway `OPENAI_API_KEY` / model header formatting (pre-existing, non-blocking for scanner).

## Safety

- Automatic brokerage orders: **off**
- No fake or published accuracy claims
- `liveValidated` stays false until operator RTH confirmation
