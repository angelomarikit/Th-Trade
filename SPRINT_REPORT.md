# Competitive Intelligence Upgrade — Sprint Report

**Date:** 2026-10-10  
**Mode:** Upgrade only (no rebuild). Automatic orders remain DISABLED. SIGNALS_ONLY.

---

## 1. Existing code recovered

**YES** — full monorepo present on disk (`apps/api`, `apps/web`, `packages/*`).

## 2. Verified starting commit

| Claimed historically | Actual |
|----------------------|--------|
| Checkpoint `3c5aa38` | **Not found** — workspace had **no `.git`** |
| Test baseline 201 | **Incorrect** — baseline was **43** passing |

**Safe checkpoint created before changes:** `8f9d711`  
`checkpoint: pre competitive-intelligence sprint baseline`

## 3. Starting test count

**43 passed** (14 files) before sprint changes.

## 4. Features already present

- Confirmation state machine (WAIT / NEAR_ACTIVE / ENTRY_ACTIVE / MISSED / INVALIDATED / NO_TRADE / DATA_NOT_VERIFIED)
- Near Active view (conditions, trigger distance, waiting list)
- Live setup card + Signal Recommendation (BUY/SELL/WAIT)
- Alpaca market-data adapter + IEX feed path
- News package (categories, dedupe cluster, WHY MOVING, mock/alpaca providers)
- Regime + sector alignment soft gates
- Journal, strategies, historical edge, options (flagged OFF)
- Trading terminal UI V2, watchlist picks, Supabase/OpenAI wiring
- Local alerts (status change + stale) — no push/SMS/email

## 5. Features added this sprint

| Area | Change |
|------|--------|
| Near Active | `permissionToEnter: false`, confirmation requirement copy, distance label, data timestamp, setup quality score on view; MISSED → “MISSED — DO NOT CHASE” label |
| Relative strength | `packages/regime/src/relativeMomentum.ts` — vs SPY/QQQ/sector, gap, RVOL, VWAP, trend, rankScore from **actual bars** |
| Ranking API | `GET /v1/rank?tickers=` + Overview watchlist ranking table |
| Setup payload | `liveCard.nearActive` detail + `liveCard.relativeMomentum` |
| News panel | WHY MOVING / NEWS CATALYST / NEWS TIME / MARKET REACTION layout |
| Mobile decision card | `DecisionCard` on Scanner with expandable checklist / news / market / edge |
| Alerts | Kind mapping (setup_found, near_active, trigger_approached, entry_zone_active, missed, invalidated, data_stale) + 60s dedupe; still local-only |

## 6. Features still mocked / limited

- **News provider:** `mock` by default (Alpaca news adapter exists; set `NEWS_PROVIDER=alpaca` when authorized)
- **Options engine:** `FEATURE_OPTIONS_ENGINE=false`
- **Stripe:** not wired
- **Push / SMS / email / WhatsApp:** not integrated — explicitly not claimed
- **Positions / Orders pages:** placeholders (no broker sync)
- **IEX limitations:** labeled on relative-momentum feed

## 7. Live provider status

| Provider | Status |
|----------|--------|
| Alpaca market data | **Operational** when credentials present (`marketDataProvider: alpaca`, feed `iex`) |
| Health check | `ok: true` observed during audit |
| Order execution | **Disabled** (`automaticOrders: false`, Thinkorswim manual) |

## 8. News provider status

**mock** (deterministic fixtures) unless `NEWS_PROVIDER=alpaca` is configured. No invented headlines.

## 9. New test count

**45 passed** (15 files) — **+2** tests (`relativeMomentum`).

## 10. Full test results

```
Test Files  15 passed (15)
Tests       45 passed (45)
```

All prior suites retained (confirmation, state machine, news, journal, options, recommend, regime, etc.).

## 11. Files changed (high level)

- `packages/confirmation/src/nearActive.ts`, `evaluateSetup.ts`, `liveCard.ts`, tests
- `packages/regime/src/relativeMomentum.ts`, `index.ts`, tests
- `packages/scanner/src/SetupScanner.ts` (momentum attach + `rankWatchlist`)
- `apps/api/src/index.ts` (`/v1/rank`, liveCard enrichment)
- `apps/web/.../DecisionCard.tsx`, `ScannerPage.tsx`, `NewsPage.tsx`, `OverviewPage.tsx`, `AlertsPage.tsx`, `TerminalContext.tsx`, `api.ts`, `styles.css`
- `SPRINT_REPORT.md` (this file)

## 12. Screenshot / preview

Open Scanner after `npm run dev:api` + `npm run dev:web`:

- **Decision card** under instrument header (STATUS, WHY MOVING, ALERT AT, zone/stop/targets, score disclaimer)
- **Overview** → “Watchlist relative momentum” table
- **News** → structured WHY IS IT MOVING? panel

(No automated screenshot captured in this environment.)

## 13. Remaining blockers

- Historical claim of 201 tests / commit `3c5aa38` cannot be verified (no prior git history)
- Live Alpaca news not enabled by default
- Relative ranking quality depends on bar depth available from IEX
- No cloud push notification channel
- Account sizing still requires `VERIFIED_ACCOUNT_VALUE` (never Alpaca paper balance)

## 14. Recommended next development phase

1. Enable and harden `NEWS_PROVIDER=alpaca` with freshness/dedupe QA in RTH
2. Multi-symbol Near Active board (ranked watchlist + status chips)
3. Persist alerts server-side (optional) without implying push delivery
4. Stripe Checkout for plans/credits
5. Walk-forward edge UI polish only when sample sizes meet validation thresholds
6. Keep options engine OFF until underlying ENTRY ACTIVE path is rock-solid

---

## Safety confirmation

- Near Active **never** grants entry (`permissionToEnter: false`)
- Completed 5m / volume / structure / liquidity / R:R / freshness rules preserved
- MISSED — DO NOT CHASE and INVALIDATED preserved
- No automatic orders
- No secrets committed (`.env` gitignored)
- Setup score **not** labeled as win probability
