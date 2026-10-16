# Wulu Trading Scanner

Greenfield hybrid market intelligence system.

**Current milestone: Phase F — Options architecture (feature-flagged OFF)**






## Principles (locked)

- Trigger ≠ entry. Price touch ≠ entry.
- News sentiment alone never creates `ENTRY ACTIVE`.
- No automatic order execution (Thinkorswim is the execution platform).
- Alpaca is market data + news only.
- Setup score / historical win rate ≠ probability the current trade wins.
- Max risk: 2% of **verified** account value only.

## Setup

```bash
cp .env.example .env
# fill ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY
npm install
npm test
npm run build
```

### News provider

| `NEWS_PROVIDER` | Behavior |
|---|---|
| `mock` (default) | Offline fixtures — safe for tests |
| `alpaca` | Official Alpaca News API |

```bash
npm run dev:api
# GET http://localhost:8787/health
# GET http://localhost:8787/v1/catalyst?ticker=NVDA
# GET http://localhost:8787/v1/setup?ticker=NVDA&side=LONG
# GET http://localhost:8787/v1/regime
# GET http://localhost:8787/v1/morning?tickers=NVDA:LONG
# GET http://localhost:8787/v1/strategies
# GET http://localhost:8787/v1/edge?strategy=VWAP_RECLAIM&ticker=NVDA
# GET http://localhost:8787/v1/journal
# GET http://localhost:8787/v1/journal/features
# GET http://localhost:8787/v1/options
```

## Monorepo

| Package | Role |
|---|---|
| `@wulu/domain` | Setup states, condition matrix, risk, setup score |
| `@wulu/news` | NewsProvider, dedupe, scoring, WHY MOVING |
| `@wulu/market-data` | Alpaca bars/quotes, freshness, mock fixtures |
| `@wulu/regime` | SPY/QQQ/IWM regime, sector alignment, strategy gates, morning brief |
| `@wulu/strategies` | Shared live/backtest strategy registry |
| `@wulu/backtest` | Costs, engine, metrics, walk-forward, historical edge panel |
| `@wulu/confirmation` | 5m/volume/structure/VWAP/R:R, Near Active, state machine |
| `@wulu/journal` | Signal journal, outcomes/MFE-MAE, feature snapshots v1 |
| `@wulu/options` | Options chain provider + ranker (flagged off; no auto orders) |
| `@wulu/scanner` | Stage-2 scan + journal + optional options |
| `@wulu/api` | HTTP API |

## Phases

- **A–E** — done
- **F** Options architecture (flagged **OFF** by default) — this release
