# Phase 5 — Market Intelligence (implementation plan)

**Status:** In progress  
**Safety:** Auto-trading disabled · min 2R unchanged · no published win rates  
**Data plan:** Alpaca Basic (IEX, ~200 REST/min) — no paid upgrade required for v1

## Parallel Phase 4

| Item | Status |
|------|--------|
| `open_signal_tracks` / `monitor_alert_dedupe` | **Verified applied** (service-role select OK) |
| Live ENTRY ACTIVE → outcome | Continue RTH soak; do not lower gates |

## Alpaca limits (why two-tier)

| Constraint | Design response |
|------------|-----------------|
| ~200 REST/min | Keep `AlpacaRequestGate` (~350ms) |
| IEX volume ≠ consolidated | Label RVOL/unusual volume as approximate |
| Full `getSnapshot` ≈ 4 calls/symbol | Deep confirmation only on top shortlist |
| Multi-symbol snapshots | Cheap discovery across ~80–120 names |
| Algo Trader Plus ~$99/mo | **Not buying for v1** — revisit only if RTH proves need |

## Architecture

1. **Discover** — liquid universe + batch snapshots + regime/news → rank LONG & SHORT  
2. **Confirm** — top candidates through existing `evaluateSetup` (unchanged)  
3. **Deep monitor** — promote into MonitorHub (max ~12)

Ranking never grants ENTRY ACTIVE.

## Tasks

### Offline (now)

- [x] Plan + Supabase verify note  
- [x] Liquid universe + sector map expand  
- [x] Batch `getDiscoverySnapshots`  
- [x] Discovery scorer (LONG/SHORT)  
- [x] `GET /v1/opportunities` + promote to monitor  
- [x] Tests + Opportunities UI  
- [ ] Deploy  

### Live market

- Discovery latency &lt; 60–90s in RTH  
- Top-N confirmation fail-closed  
- Deep monitor cycle ≤ ~90s at 12 symbols  
- Continue ENTRY ACTIVE soak  

## Estimate

**~3–5 focused days** to Phase 5 v1 in production (offline first, RTH validate in parallel).
