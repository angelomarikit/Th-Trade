# Phase 6 — Historical backtesting, strategy improvement & measured performance

**Safety:** Auto-trading disabled · min 2R unchanged · no published win rates without verified live results  
**Builds on:** `@wulu/backtest` engine, walk-forward, signal_performance_records, `/v1/replay`

## Scope

| Offline (now) | Later / RTH |
|---------------|-------------|
| Measured performance aggregator (LIVE vs REPLAY, sample floors) | Operator `liveValidated` marking |
| Multi-strategy backtest compare API | RTH outcome accumulation |
| Backtest UI: strategy picker + walk-forward + history panel | |
| Tests + deploy | |

## Rules

- Never invent trades or win rates when sample size is insufficient  
- Always separate **HISTORICAL_REPLAY** vs **LIVE** vs **liveValidated**  
- Historical edge ≠ future guarantee (existing disclaimers stay)
