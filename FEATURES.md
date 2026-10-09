# Wulu Trading Scanner — Product Summary

**Status:** Phases A–G built. Signals-only terminal (no auto-orders).  
**Last updated:** 2026-10-10

Wulu is a hybrid market-intelligence scanner: live Alpaca data + confirmation matrix + rule-based Signal Recommendation, with optional ChatGPT narration and Supabase auth/plans/credits.

---

## What it is

A desktop/mobile trading terminal that helps you **decide** what to do (BUY / SELL / WAIT) from live setup confirmation — then you execute manually in Thinkorswim. Alpaca is used for **market data and news only**, never for order submission.

---

## Locked safety principles

| Rule | Meaning |
|------|---------|
| Trigger ≠ entry | Price touch alone is not an entry |
| News never alone → ENTRY ACTIVE | Catalyst is context, not a green light |
| Fail-closed on stale data | Unverified / stale quotes → no actionable signal |
| No automatic orders | SIGNALS_ONLY — Thinkorswim for execution |
| Setup score ≠ win probability | Score and historical edge are context, not a forecast |
| Risk sizing | Max 2% of **verified** account value only (`VERIFIED_ACCOUNT_VALUE`) |

---

## Feature list

### 1. Live setup scanner

- Scan any ticker LONG or SHORT via API / terminal
- Live setup card: status, conditions passed, entry zone, stop, targets, R:R, setup score
- Confirmation matrix (spread/liquidity, volume/RVOL, structure, VWAP, session, regime, etc.)
- Near Active + waiting-for list when setup is close but not ready
- Session awareness (RTH / premarket / closed) with America/New_York clock
- Data freshness checks (fail closed when stale)

### 2. Signal Recommendation (automatic BUY / SELL / WAIT)

- Derived automatically from the live confirmation card on every Scan
- **BUY** (LONG) or **SELL** (SHORT) only when recommendation is **ACTIONABLE**
- Everything else → **WAIT** (WATCH / PREPARE / NO_TRADE / AVOID)
- Shows confidence, reasons, blockers, last price, brief text
- **Watchlist picks** inside the panel — tap a symbol; signal updates dynamically
- LONG / SHORT toggle rescans immediately
- Background poll (~20s) refreshes **rules only** (no credit drain)
- Optional **model brief** (OpenAI) on explicit Scan / Refresh model brief

### 3. Watchlist

- Local browser watchlist (add / remove / star from instrument header)
- Symbols appear as selectable chips in Signal Recommendation
- Click a watchlist row → opens Scanner on that symbol
- Not account-synced yet

### 4. Charts

- Candlestick chart (lightweight-charts)
- Timeframes: 1m / 5m / 15m / 1D (as wired in UI)
- Overlay levels: trigger, entry zone, stop, T1, T2 when setup is present

### 5. Market regime & morning brief

- SPY / QQQ / IWM-style regime bias and primary regime label
- Strategy gates from regime package
- Morning brief endpoint for multi-ticker desk-style summary

### 6. News / catalyst (“Why moving”)

- News provider: `mock` (default) or `alpaca`
- Catalyst label, news age, price reaction
- Provenance shown on News page — news alone cannot create ENTRY ACTIVE

### 7. Strategies & historical edge

- Shared strategy registry (live + backtest semantics)
- Historical edge panel (sample size, expectancy R, win rate, summary)
- Edge is informational — negative expectancy can block ACTIONABLE → PREPARE

### 8. Signal journal

- SQLite (or memory) journal of scans / outcomes hooks
- Journal page in terminal; feature snapshots API
- Supports learning / review workflows (not live order fill tracking from a broker)

### 9. Options engine (flagged OFF)

- Architecture present (`FEATURE_OPTIONS_ENGINE=false` by default)
- Ranking / best-contract card path exists but stays disabled until underlying is validated
- No options auto-orders

### 10. Trading terminal UI (V2)

| Page / area | Purpose |
|-------------|---------|
| Overview | Selected symbol, feed health, recent scans, alerts |
| Scanner | Chart + instrument header + inspector + Signal Recommendation |
| Watchlist | Manage local symbols |
| Signals | Strategy-matched signal context |
| Charts | Dedicated chart view |
| News | Catalyst / why-moving |
| Journal | Local signal journal entries |
| Backtest / Edge | Historical edge for symbol/strategy |
| Positions / Orders | Placeholder — no broker sync (signals only) |
| Alerts | Local browser alerts (status change, stale data) |
| Billing | Plans + credits (manual select until Stripe) |
| Settings | Account / health / OpenAI & Supabase flags |
| Login / Register | Supabase Auth |

Shell: sidebar + mobile nav, top symbol search (`/` focus), ET clock, feed badges, inspector toggle.

### 11. Auth, plans & credits (Supabase)

- Supabase Auth (email) + profiles
- Plan tiers: Free, Basic, Standard, Premium, Ultra
- Monthly credit allowances; spend credits for model briefs
- Free tier includes starter credits for model briefs when OpenAI is configured
- Manual plan select in-app (Stripe Checkout **not wired yet**)
- Health exposes `supabaseConfigured` / `openaiConfigured`

### 12. OpenAI narration

- Model (default `gpt-4o-mini`) **narrates only** — cannot upgrade WAIT → BUY/SELL
- Used when `brief=1` / Refresh model brief and credits/plan allow
- Falls back to rules brief if key missing, credits low, or API error

---

## Tech stack

| Layer | Stack |
|-------|--------|
| Monorepo | npm workspaces, TypeScript, Vitest |
| API | Node HTTP on `:8787` (`apps/api`) |
| Web | Vite + React + React Router (`apps/web`) |
| Charts | lightweight-charts |
| Data | Alpaca IEX bars/quotes (+ optional news) |
| Auth / DB | Supabase |
| AI | OpenAI Chat Completions |
| Packages | `domain`, `news`, `market-data`, `regime`, `strategies`, `backtest`, `confirmation`, `journal`, `options`, `scanner` |

---

## Main API endpoints

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | Providers, flags, OpenAI/Supabase ready |
| GET | `/v1/setup?ticker=&side=&brief=1` | Live card + Signal Recommendation |
| GET | `/v1/bars?ticker=&tf=` | OHLC bars for charts |
| GET | `/v1/catalyst?ticker=` | Why moving / news |
| GET | `/v1/regime` | Market regime |
| GET | `/v1/morning?tickers=` | Morning brief |
| GET | `/v1/strategies` | Strategy list |
| GET | `/v1/edge?strategy=&ticker=` | Historical edge |
| GET | `/v1/journal` | Journal entries |
| GET | `/v1/options` | Options (flagged) |
| POST | `/v1/recommend` | Explicit recommend + optional model brief |
| GET | `/v1/plans` | Plan catalog |
| GET | `/v1/me` | Profile + plan (auth) |
| POST | `/v1/billing/select-plan` | Manual plan assign (auth) |

---

## How Signal Recommendation works (at a glance)

```
Alpaca data → Confirmation matrix → Live setup card
        ↓
Rule engine → ACTIONABLE? → BUY/SELL else WAIT
        ↓
Optional OpenAI brief (narrate only, never override action)
        ↓
Terminal panel + watchlist symbol picks
```

---

## Run locally

```bash
cp .env.example .env
# Fill Alpaca, Supabase, OpenAI keys as needed
npm install
npm run dev:api    # http://localhost:8787
npm run dev:web    # Vite (proxies API in dev)
```

Run **one** API instance only (port `8787`). Apply `supabase/schema.sql` in your Supabase project for profiles/credits.

---

## Not built yet / out of scope

- Stripe Checkout & webhooks (planned)
- Broker order routing / Positions & Orders live sync
- Account-synced watchlist / cloud alerts push
- Options engine enabled in production
- Continuous multi-symbol signal broadcast

---

## Product one-liner

**Wulu scans live setups, confirms with a fail-closed matrix, and automatically recommends BUY, SELL, or WAIT — with optional AI narration — while you execute manually.**
