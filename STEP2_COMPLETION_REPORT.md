# Step 2 Completion Report — Automatic Multi-Stock Monitoring

**Date:** 2026-04-11  
**Status:** COMPLETE (dev / pre-launch)  
**Scope:** Server-side monitoring of up to 6 symbols; preserve existing foundation

---

## What was built

### Backend (`@wulu/scanner`)
- **`WatchMonitor`** — per-session monitor that:
  - Holds a watchlist of up to **6** symbols (configurable via `MONITOR_MAX_SYMBOLS`)
  - Polls `SetupScanner.scan` for each symbol every **~20 seconds** (`MONITOR_INTERVAL_MS`)
  - Runs on the **API process** (not in the browser)
  - Ranks symbols by setup readiness (score + NEAR ACTIVE / ENTRY ACTIVE bias; stale data penalized)
  - Exposes add / remove / set-watchlist / snapshot / tick
- **`MonitorHub`** — one `WatchMonitor` per authenticated user id (or `"default"` if unauthenticated)
- **`MonitorLimitError`** — hard cap at max symbols (subscription tiers later)

### API (`apps/api`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/monitor` | Full snapshot (symbols, states, ranked, tick metadata) |
| PUT | `/v1/monitor/watchlist` | Replace watchlist; immediate scan |
| POST | `/v1/monitor/symbols` | Add one symbol; immediate scan |
| DELETE | `/v1/monitor/symbols/:ticker` | Remove symbol |
| POST | `/v1/monitor/tick` | Force one scan cycle |

Session key: Supabase JWT user id when `Authorization` is present; otherwise `"default"`.

CORS updated to allow `PUT` and `DELETE`. Monitor timers stopped on SIGINT/SIGTERM.

### Frontend (`apps/web`)
- **Watchlist page → Live Monitor** (`/watchlist`)
  - Load default six: TSLA, MU, NVDA, AMD, SPY, QQQ
  - Add / remove symbols with LONG/SHORT
  - Ranked cards: status, price, trigger, entry zone, stop, T1/T2, quality score, waiting reasons
  - Polls snapshot every 8s for UI refresh (scans continue server-side even if the tab closes)
  - “Scan now” forces a backend tick
- Nav label: **Live Monitor** (sidebar) / **Monitor** (mobile)

Existing single-symbol Scanner, auth, Alpaca setup endpoint, and confirmation engine were **not** rebuilt.

---

## What is now working

1. Users can set a multi-symbol watchlist (max 6 for Step 2).
2. Backend continuously rescan those symbols while the API is running.
3. Dashboard shows all monitored stocks with live status from the existing confirmation engine.
4. Ranking by readiness is available in the snapshot and UI.
5. Add / remove / replace watchlist works via API + UI.
6. Monitoring does **not** require the browser to stay open (only the Railway/API process).
7. Automatic order execution remains disabled.
8. Existing automated tests still pass; Step 2 unit tests added.

---

## What is still incomplete (by design — later steps)

| Item | Planned step |
|------|----------------|
| Richer breakout / fake-breakout signal intelligence | Step 3 |
| Automatic NEAR ACTIVE / ENTRY ACTIVE push alerts | Step 4 |
| Mobile push / email / SMS | Step 4 |
| Live news intelligence upgrades | Step 5 |
| Advanced entry/stop/target structure | Step 6 |
| Historical accuracy tracking | Step 7 |
| Options intelligence | Step 8 |
| Morning command center auto-picks | Step 9 |
| Subscription-enforced limits (Basic 1–3, Premium 5–6, etc.) | Step 12 — cap is fixed at 6 for now |
| Persist watchlist across API restarts | Not yet (in-memory per process) |
| Horizontal scale / multi-instance monitor coordination | Future reliability work |

---

## Files / systems changed

| Path | Change |
|------|--------|
| `packages/scanner/src/WatchMonitor.ts` | **New** — WatchMonitor, MonitorHub |
| `packages/scanner/src/index.ts` | Export monitor types |
| `packages/scanner/tests/watchMonitor.test.ts` | **New** — unit tests |
| `apps/api/src/index.ts` | Monitor routes, hub wiring, CORS, shutdown |
| `apps/web/src/lib/api.ts` | Monitor client helpers |
| `apps/web/src/pages/WatchlistPage.tsx` | Live Monitor dashboard |
| `apps/web/src/components/shell/Sidebar.tsx` | Nav label |
| `apps/web/src/components/shell/MobileNav.tsx` | Nav label |
| `STEP2_COMPLETION_REPORT.md` | This report |

---

## Existing features — regression check

- Single-symbol `/v1/setup` scanner path unchanged.
- Auth, billing/me, bars, journal, regime, rank, morning, options routes unchanged.
- Confirmation / fail-closed engine reused by the monitor (no parallel signal logic).
- Auto-execution still off (`EXECUTION_POLICY` / health `SIGNALS_ONLY`).

---

## Test results

```
npm test
→ Test Files  17 passed (17)
→ Tests       51 passed (51)
```

Previous baseline was 49 tests; **+2** WatchMonitor tests.

Also verified:
```
npm run build -w @wulu/scanner -w @wulu/api
→ success
```

### What still needs additional testing (manual / live)

1. Deploy API to Railway and confirm `/v1/monitor` returns snapshots with live Alpaca data during RTH.
2. Load the default six on production UI; leave the browser closed for several minutes; reopen and confirm `tickCount` / `lastTickAt` advanced.
3. Weekend / closed market: expect DATA NOT VERIFIED / non-actionable states (correct fail-closed behavior).
4. Concurrent users: each JWT should get an isolated monitor session.
5. Rate limits: six symbols × ~20s sequential scans under Alpaca IEX — watch for 429s under load.

---

## Errors / blockers

- None blocking Step 2 completion in local tests/build.
- Watchlist is **in-memory**: Railway redeploy clears monitored symbols (user must reload watchlist). Persistence can be a small follow-up if needed before Step 3.
- Live trading accuracy is **not** validated by these unit tests — only multi-symbol orchestration.

---

## Recommended next step

**Step 3 — Intelligent signal detection** (status progression, fake-breakout filters), building on this multi-stock monitor rather than replacing it.
