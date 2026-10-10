# Wulu Trading Scanner — Production Audit Report

**Date:** 2026-10-11  
**Sites tested:**
- Frontend: https://web-tawny-iota-56.vercel.app/
- API: https://th-trade-production.up.railway.app

**Scope:** Inspect existing frontend, backend, APIs, env wiring, market-data, scanner logic, and Vercel deployment.  
**Constraints:** No rebuild/replace. Automatic trading remains disabled. No API keys exposed.

**Tests:** **49/49 passing** (includes +3 focused audit checks for levels / VWAP / RSI–EMA scope).  
**Market session at audit:** **WEEKEND** (fail-closed expected).  
**Auto-trading:** `automaticOrders: false` (SIGNALS_ONLY).

---

## Direct answers

| # | Question | Verdict |
|---|----------|---------|
| 1 | Which features are fully functional? | See **VERIFIED WORKING** |
| 2 | Which are mocked, hardcoded, or placeholders? | See **DEMO ONLY** / **PARTIALLY WORKING** |
| 3 | Is Alpaca connected and receiving real market data? | **VERIFIED WORKING on Railway** (bars + quotes). Local `.env` keys still **401** (out of sync) |
| 4 | Is the scanner automatically analyzing stocks? | **PARTIAL** — polls the **selected** symbol ~every 20s; not a multi-ticker universe scanner |
| 5 | Are VWAP, RSI, EMA, volume and five-minute candles calculated correctly? | **VWAP + RVOL + 5m: VERIFIED** in confirmation. **RSI/EMA: helpers only** for strategy matching — **not** live matrix gates / not chart overlays |
| 6 | Are entry, stop-loss and target prices based on real data? | **PARTIAL** — derived from **real 5m highs/lows**, but geometry is **provisional** (fixed R multiples), not per-strategy |
| 7 | Are news, options chains and alerts connected? | News: **DEMO (mock)**. Options: **OFF**. Alerts: **local browser only** |
| 8 | What errors prevent the scanner from working in real time? | Weekend fail-closed; mock news; local key drift; no multi-symbol auto-scan; ENTRY needs full confirmation in RTH |

---

## Status by feature

### VERIFIED WORKING

- Railway `/health` — Alpaca credentials present, Supabase + OpenAI configured, options off, no auto orders
- CORS allows `https://web-tawny-iota-56.vercel.app`
- Live Alpaca **IEX** bars (`/v1/bars`) and setup prices (e.g. NVDA last ~231.5 at audit)
- Confirmation matrix: DATA_FRESHNESS, LIQUIDITY, VWAP, RVOL, STRUCTURE, FIVE_MIN, R:R, regime/sector
- Weekend → `DATA NOT VERIFIED` / Signal **WAIT** (fail-closed by design)
- Relative-momentum rank (`/v1/rank`) from real bars
- Vercel login UI + logo branding
- Signal Recommendation engine (rules → WAIT when not actionable)
- Unit/integration tests (**49**)

### PARTIALLY WORKING

- **Website scanner** — requires login; depends on Railway; feed OK only when API + keys OK
- **Auto-scan** — single-symbol poll (~20s), not watchlist-wide continuous analysis
- **Levels** — from real bars, but simple structure formula (not full strategy geometry)
- **RSI/EMA** — computed in `@wulu/strategies` helpers; **not** required for ENTRY ACTIVE
- **OpenAI briefs** — configured; often **RULES** unless `brief=1` + credits/plan
- **Local vs Railway Alpaca keys** — Railway works; local `.env` still 401

### DEMO ONLY

- `NEWS_PROVIDER=mock` — fixture catalysts (e.g. “NVIDIA raises guidance after earnings beat”)
- Positions / Orders pages (signals-only placeholders)
- Stripe billing not wired
- Journal on Railway starts empty / ephemeral if `JOURNAL_STORE=memory`

### BROKEN / BLOCKING “go live” actionable signals

- **Not a code defect:** market closed (weekend) forces stale/fail-closed (by design)
- Local Alpaca keys invalid → local `dev:api` still fails data calls until synced
- No true multi-name automatic scanner board

---

## Live evidence (this audit)

### Health

- `ok: true`
- `marketDataProvider: alpaca`
- `newsProvider: mock`
- `alpacaCredentialsPresent: true`
- `automaticOrders: false`
- `supabaseConfigured: true`
- `openaiConfigured: true`
- `optionsEngine: false`

### Setup (NVDA LONG, weekend)

- Status: `DATA NOT VERIFIED`
- Session: `WEEKEND`
- VWAP: **PASS**
- FIVE_MIN: **WAITING**
- Signal: **WAIT** / `NO_TRADE`
- Levels present: alert / zone / stop / T1 / T2 from bar structure

### Bars

- Provider: Alpaca, feed: IEX
- Completed 5m bars with VWAP + volume

### Options

- `FEATURE_OPTIONS_ENGINE=false` — disabled by design

### Catalyst

- Mock verified event present (not live Alpaca news)

### Frontend

- Login gate at `/login` (Supabase Auth UI)

---

## Test suite

```
Test Files  16 passed (16)
Tests       49 passed (49)
```

Focused audit file added:

- `packages/confirmation/tests/levelsAndIndicators.audit.test.ts`
  - Levels from completed 5m structure
  - VWAP / RVOL / FIVE_MIN on matrix; RSI/EMA not confirmation gates
  - Strategy RSI/EMA helpers finite

---

## Prioritized implementation plan

Preserve existing work. Keep automatic trading **disabled**. Never commit or expose API keys.

### P0 — Real data reliability (this week)

1. Sync Alpaca keys: regenerate → update Railway **and** local `.env` → confirm `node scripts/check-alpaca.mjs` ≠ 401
2. Keep `ALPACA_DATA_BASE_URL=https://data.alpaca.markets`
3. Set `NEWS_PROVIDER=alpaca` on Railway only after keys work; keep fail-closed (news ≠ ENTRY)
4. Smoke: `/health` + `/v1/setup` + `/v1/bars` during RTH

### P1 — Reliable signals in RTH

1. Validate RTH path: `DATA_FRESH` + Near Active → Entry Active only with completed 5m + volume + structure + R:R
2. Watchlist multi-scan job (sequential / rate-limited) with Near Active board — still no auto orders
3. Surface VWAP / RVOL / 5m clearly on Decision Card
4. Optionally add RSI/EMA as **soft** matrix rows (not sole ENTRY gates) if product requires them

### P2 — Product completeness

1. Live news panel with provenance (UI structure already exists)
2. Server-side alert log (no SMS/push until delivery is tested)
3. Persist journal on Railway
4. Strategy-specific level geometry replacing provisional `deriveLevels`

### P3 — Later

1. Stripe Checkout
2. Options engine behind flag after ENTRY ACTIVE proven in RTH
3. Keep Thinkorswim as manual execution platform

---

## Bottom line

The deployed stack is **wired and talking to Alpaca for prices/bars**. It is **not** yet a full real-time multi-stock signal machine: news is mock; RSI/EMA are not live confirmation gates; weekend correctly blocks actionable entries.

**Next win:** key sync + RTH validation + watchlist auto-scan, with orders still off.

---

## Safety confirmation

| Rule | Status |
|------|--------|
| Automatic orders disabled | VERIFIED |
| News cannot alone create ENTRY ACTIVE | VERIFIED (architecture + matrix) |
| Fail-closed on weekend / stale data | VERIFIED (live weekend audit) |
| Near Active ≠ entry permission | VERIFIED |
| Secrets not in git | VERIFIED (`.env` gitignored) |
