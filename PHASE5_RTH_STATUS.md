# Phase 5 — Regular-market-hours validation status

Tracked alongside Phase 6 so development does not stall.

| # | Check | AH / offline | RTH required | Notes |
|---|--------|--------------|--------------|-------|
| 1 | Discovery ≠ ENTRY permission | Done | Spot-check | Rank never grants ENTRY ACTIVE |
| 2 | Confirm fail-closed (no fake ENTRY) | Done AH | Spot-check | Unchanged min 2R gates |
| 3 | 10–12 monitored symbols | Hub supports 12 | **Open** | Needs auth + RTH load |
| 4 | Data freshness under load | Partial | **Open** | Measure quote age / cycleMs |
| 5 | Alert speed | Not signed off | **Open** | Near-trigger → alert latency |
| 6 | Confirm latency | Baseline 165s → optimized | **Re-measure** | Use `confirmElapsedMs` |

**Next RTH window:** run authenticated promote of 10–12 names, watch MonitorHub cycleMs + alert timestamps, capture `/v1/opportunities?confirm=3` timings.

**Note (2026-10-13 ~08:30 UTC+8):** Still outside US RTH for this session. Confirm latency already re-measured AH (~9–12s). Items 3–5 remain open until a regular session. Tracked in parallel with Phase 7.
