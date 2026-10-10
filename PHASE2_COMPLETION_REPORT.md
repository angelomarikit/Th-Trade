# WULU SCANNER — PHASE 2 COMPLETION REPORT

**Date:** 2026-10-11  
**Objective:** Automatic six-stock server-side monitoring on the existing platform  
**Checkpoint branch:** `checkpoint/pre-phase2-826f76f`

---

## 1. Starting condition

| Item | Value |
|------|--------|
| Repository | `angelomarikit/Th-Trade` (local: wulu trading scanner) |
| Branch | `main` |
| Starting commit | `826f76f` (“fixing it” — included prior Step 2 WatchMonitor draft) |
| Baseline tests | **51/51** passing |
| Features already present | Vercel web, Railway API Docker, Alpaca IEX, Supabase auth, confirmation engine, single-symbol ~20s poll, relative momentum rank, OpenAI briefs, journal, auto-trading **disabled** |
| Railway architecture verified | Long-running Node HTTP server via Dockerfile (`npm run start` / `build:api`) — background `setInterval` in-process is valid for this deploy model |
| Env names (values not revealed) | `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`, `ALPACA_DATA_FEED`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_API_BASE`, `MONITOR_MAX_SYMBOLS`, `MONITOR_INTERVAL_MS`, … |

---

## 2. Features implemented

| Feature | Summary |
|---------|---------|
| Multi-symbol monitoring | `MonitorHub` single shared loop; up to 6 symbols; default TSLA/MU/NVDA/AMD/SPY/QQQ |
| User watchlists | Add / remove / replace / set / defaults; backend max-6 + ticker validation |
| Persistence | Supabase tables `monitor_watchlists` + `monitor_alert_events`; resume after restart |
| Live dashboard | **WULU LIVE WATCHLIST** at `/watchlist` |
| Status updates | User-facing WAIT / NEAR ACTIVE / CONFIRMATION / ENTRY ACTIVE / MISSED / INVALIDATED / DATA NOT VERIFIED (mapped from existing engine) |
| Ranking | Readiness score (setup quality, near/confirmation/entry, RVOL, VWAP, distance; stale/missed penalized) |
| Alert events | Recorded status-change events with dedupe; **no SMS/push** yet |

---

## 3. Architecture

### Backend worker / scheduler
- Runs **inside the Railway API process** (verified Dockerfile long-running server).
- One `setInterval` in `MonitorHub` (default 20s via `MONITOR_INTERVAL_MS`).
- Overlap guard (`ticking` flag); graceful `SIGINT`/`SIGTERM` stop.
- On boot: load all `monitor_watchlists` and restore sessions.

### Data-fetching strategy
- Collect unique `(symbol, side)` across users each cycle → **one** `SetupScanner.scan` per pair.
- Sequential scans to respect Alpaca rate limits.
- Reuses existing confirmation matrix / fail-closed freshness (weekend `maxDataAgeMs: 0`).
- Metrics: `lastCycleMs`, `uniquePairsLastCycle`, `failedScansLastCycle` on `/health` → `monitor`.

### Database changes
- Migration: `supabase/migrations/20261011_phase2_monitor.sql`
- Also appended to `supabase/schema.sql`
- RLS: users can SELECT own rows; API uses service role for upserts

### API endpoints
| Method | Path |
|--------|------|
| GET | `/v1/monitor` |
| PUT | `/v1/monitor/watchlist` |
| POST | `/v1/monitor/symbols` (optional `replace` for swap) |
| DELETE | `/v1/monitor/symbols/:ticker` |
| POST | `/v1/monitor/tick` |
| POST | `/v1/monitor/defaults` |
| GET | `/v1/monitor/events` |

Auth: when Supabase is configured, watchlist mutations require Bearer token (isolation by `user.id`).

---

## 4. Verification

| Check | Result |
|-------|--------|
| Total passing tests | **59/59** (was 51; +8 Phase 2 monitor tests) |
| Failed tests | **0** |
| Build `@wulu/scanner` | OK |
| Build `@wulu/api` | OK |
| Build `@wulu/web` | OK |
| Provider connectivity | Production `/health` previously OK with credentials present; weekend → DATA NOT VERIFIED by design |
| Average scan/update time | Exposed as `hub.lastCycleMs` after ticks (measure live after deploy) |
| Rate-limit behavior | Sequential unique-pair scans; no six uncontrolled loops |
| Browser-closed monitoring | Hub timer independent of browser (requires deployed API process up) |
| Data freshness | Existing `assessFreshness` + session WEEKEND/CLOSED fail-closed preserved |
| Automatic trading | `automaticOrders: false` asserted in tests + snapshot field |

---

## 5. Deployment

| Item | Status |
|------|--------|
| Changes committed | See git log after this report’s commit |
| Vercel updated | **Pending** auto-deploy after push to `main` (or manual) |
| Railway updated | **Pending** auto-deploy after push |
| Supabase migrations | **User action required** — run `supabase/migrations/20261011_phase2_monitor.sql` in SQL editor |
| Live URL verification | **Pending** post-deploy: open `/watchlist`, load default six, confirm hub ticks advance with browser closed |

### Remaining deployment actions for operator
1. Apply Supabase migration SQL.
2. Push `main` (if not already) and wait for Railway + Vercel.
3. Confirm `VITE_API_BASE=https://th-trade-production.up.railway.app` on Vercel (no trailing slash).
4. Sign in → Live Monitor → “Load default six” → verify cards populate from Alpaca (weekend = DATA NOT VERIFIED expected).

---

## 6. Outstanding work

- Supabase migration must be applied before persistence/resume works in production.
- Live RTH validation of ENTRY ACTIVE / NEAR ACTIVE cards still pending (weekend at report time).
- Push/SMS/email delivery not implemented (events recorded only).
- Subscription tier limits not enforced from `plan_tier` yet (hard cap 6; plan `maxWatchlist` exists for future).
- IEX feed ≠ consolidated volume — labeled in UI/API notes.
- Screenshots of live Entry Active require RTH or labeled DEMO replay (not fabricated here).

---

## 7. Screenshots

| Shot | Status |
|------|--------|
| Updated Wulu Live Watchlist | UI shipped at `/watchlist` — capture after Vercel deploy |
| Six-stock board | “Load default six” button |
| Near Active card | Live when engine returns NEAR ACTIVE / CONFIRMATION |
| Entry Active card | **Not claimed** without live/RTH verification; use scanner replay fixtures only if labeled DEMO |

---

## 8. Final verdict

| Feature | Verdict |
|---------|---------|
| Multi-symbol monitoring (shared hub) | **VERIFIED WORKING** (unit + build) — **IMPLEMENTED — LIVE VALIDATION PENDING** on Railway |
| User watchlists (add/remove/replace/limit) | **VERIFIED WORKING** (unit) |
| Persistent watchlists (Supabase) | **IMPLEMENTED — LIVE VALIDATION PENDING** (migration apply required) |
| Live dashboard | **VERIFIED WORKING** (build) — deploy pending |
| Status mapping + confirmation engine reuse | **VERIFIED WORKING** |
| Opportunity ranking | **VERIFIED WORKING** (unit) |
| Alert event recording + dedupe | **VERIFIED WORKING** (memory; Supabase dual-write pending migration) |
| Push/SMS alerts | **NOT IMPLEMENTED** (by design this phase) |
| Automatic trading still disabled | **VERIFIED WORKING** |
| Weekend / stale fail-closed | **VERIFIED WORKING** (existing + unit mapping) |

**Phase 2 core scanner orchestration: complete in code and tests.**  
**Do not treat as production-validated for live ENTRY ACTIVE until RTH check + migration + deploy verification.**

---

## Key files

- `packages/scanner/src/WatchMonitor.ts`
- `packages/scanner/src/alertEvents.ts`
- `packages/scanner/src/displayStatus.ts`
- `apps/api/src/monitor/persistence.ts`
- `apps/api/src/monitor/alertStore.ts`
- `apps/api/src/index.ts`
- `apps/web/src/pages/WatchlistPage.tsx`
- `supabase/migrations/20261011_phase2_monitor.sql`
