# Wulu Trading Scanner — Status Report for Leadership

**Date:** October 12, 2026  
**Prepared for:** Project leadership review  
**Product:** Wulu Trading Scanner  
**Stage:** Development (pre-launch — not open to paying customers)

---

## Executive summary

Wulu has a working foundation: live website, authentication, Alpaca market data, technical confirmation engine, and a single-symbol scanner. Phase 2 (automatic six-stock monitoring) is **complete in code and fully tested locally**, and has been **pushed to GitHub**. The Supabase database migration for watchlists is **already applied**.

The main gap is **production backend deployment**: Railway is still running an older API build, so the live six-stock monitor endpoints are not available yet. Once Railway redeploys the latest commit, the live watchlist board can be verified end-to-end.

Automatic brokerage order execution remains **disabled**. The product is signals-only.

---

## Live environments

| Component | URL | Status |
|-----------|-----|--------|
| Frontend | https://web-tawny-iota-56.vercel.app/ | Live (login + scanner UI) |
| Backend API | https://th-trade-production.up.railway.app | Live, but **not yet on latest Phase 2 code** |
| Auth / database | Supabase | Configured; Phase 2 tables present |

---

## Version control

| Item | Value |
|------|--------|
| Latest commit on GitHub (`main`) | `79cdd7b76ac5730815f10941f7c2e8fcc2370e46` |
| Short hash | `79cdd7b` |
| Commit message | feat: Phase 2 shared multi-stock monitor with persistent watchlists |
| Recoverable checkpoint (pre–Phase 2) | Branch `checkpoint/pre-phase2-826f76f` |
| Exact commit currently running on Railway | **Not exposed by API health** — behavior indicates an **older build** (multi-stock routes return 404) |

---

## What is already working

1. Website and user login (Supabase authentication)
2. Railway backend connected to Alpaca market data (IEX feed)
3. Real stock prices and five-minute candles (when the feed/auth path is healthy)
4. VWAP and relative-volume calculations
5. Technical confirmation rules and setup scoring
6. Market / sector relative-momentum ranking
7. Fail-closed behavior when data is stale or the market is closed (**DATA NOT VERIFIED** — no actionable signal)
8. Signal recommendation layer (rules + optional OpenAI narrative)
9. Trade journal storage
10. **Automatic trading disabled** (signals only; traders execute elsewhere)

---

## Phase 2 — Multi-stock monitoring (current development focus)

### Delivered in code (GitHub `79cdd7b`)

| Capability | Description |
|------------|-------------|
| Server-side monitoring | Backend monitors up to **6 symbols** on a shared schedule (~20 seconds); does **not** require the browser to stay open |
| Default watchlist | TSLA, MU, NVDA, AMD, SPY, QQQ |
| User watchlist management | Add, remove, replace, save; backend enforces the 6-symbol limit |
| Live dashboard | **WULU LIVE WATCHLIST** page (`/watchlist`) — all monitored stocks on one board |
| Status model | WAIT → NEAR ACTIVE → CONFIRMATION → ENTRY ACTIVE → MISSED / INVALIDATED / DATA NOT VERIFIED |
| Ranking | Stocks ordered by setup readiness (stale / missed setups demoted) |
| Alert event log | Status-change events recorded for later analysis (**no SMS/push yet**) |
| Architecture | One shared scan loop; unique symbols scanned once per cycle and shared across users where appropriate |

### Database migration status

| Table | Status |
|-------|--------|
| `monitor_watchlists` | **Applied** in Supabase |
| `monitor_alert_events` | **Applied** in Supabase |
| Data rows | **0** (expected until the new API is live and users save a watchlist) |

### Production verification status

| Check | Result |
|-------|--------|
| `GET /v1/monitor` on Railway | **404 — not deployed yet** |
| Six-stock board screenshot (live) | **Not available** — login required; API routes missing on production |
| Local automated tests | **59 / 59 passed** (October 12, 2026) |

---

## Test results (latest)

```
Test files:  17 passed
Tests:       59 passed
Failures:    0
```

These tests cover the multi-stock monitor, confirmation safety rules, market-session handling, and related core packages. They prove software correctness of the new monitor; they do **not** by themselves prove live trading accuracy during regular market hours.

---

## Remaining blockers (priority order)

1. **Redeploy Railway from GitHub `main` @ `79cdd7b`**  
   Until this completes, the live multi-stock API will keep returning 404.

2. **Confirm frontend API base URL**  
   Vercel `VITE_API_BASE` should point to `https://th-trade-production.up.railway.app` (no trailing slash).

3. **Post-deploy smoke test**  
   Sign in → Live Monitor → “Load default six” → confirm six cards update and hub tick count advances with the browser closed.

4. **Live regular-hours validation**  
   Near Active / Entry Active behavior should be reviewed during U.S. market hours (weekend/closed sessions correctly fail closed).

5. **Not blockers for Phase 2 core, but not done yet**  
   Mobile push / SMS alerts, live news (currently mocked), options intelligence, historical accuracy dashboard, Stripe subscriptions.

---

## Development roadmap (high level)

| Phase | Focus | Status |
|-------|--------|--------|
| 1 | Foundation (web, API, auth, Alpaca, basic scanner) | **Complete** |
| 2 | Automatic six-stock server-side monitoring | **Code + tests complete; production deploy pending** |
| 3 | Stronger signal detection / fake-breakout filters | Next |
| 4 | Automatic user alerts (browser / mobile / email) | Later |
| 5+ | News intelligence, advanced levels, backtesting proof, options, subscriptions, launch readiness | Later |

---

## Risk and compliance notes

- Product is still in **development**. It is not positioned as a finished commercial trading product.
- **No automatic order execution** is enabled.
- Market data uses Alpaca **IEX** (subset of U.S. volume — not consolidated tape). UI/API label this limitation.
- We do **not** claim win-rate percentages without measured evidence.
- Prefer **NO TRADE / DATA NOT VERIFIED** over unreliable entries.

---

## Recommended next action for the team

1. Trigger / confirm Railway redeploy of commit **`79cdd7b`**.  
2. Verify `https://th-trade-production.up.railway.app/v1/monitor` returns **200**.  
3. Capture screenshots of the six-stock Live Watchlist for leadership.  
4. Proceed to Phase 3 only after that live verification.

---

## Appendix — key documents in the repository

| Document | Purpose |
|----------|---------|
| `PHASE2_COMPLETION_REPORT.md` | Detailed Phase 2 engineering completion report |
| `STEP2_COMPLETION_REPORT.md` | Earlier Step 2 monitor report |
| `AUDIT_REPORT.md` | Prior production audit notes |
| `supabase/migrations/20261011_phase2_monitor.sql` | Watchlist / alert-event migration (already applied) |

---

*End of report.*
