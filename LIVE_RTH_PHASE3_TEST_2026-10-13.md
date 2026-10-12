# Live RTH Phase 3 test — US session **Monday 2026-10-12** (~14:04 ET)

**Calendar / timezone note:**  
- UI clock and market session use **America/New_York**.  
- Capture was **Mon 14:04 ET on 2026-10-12** (RTH).  
- In UTC+8 that same moment falls on **Tuesday 2026-10-13** morning — hence the date confusion.  
- Weekday on the TopBar (`formatEtClock`) is correct for ET; reports should always label the **ET trading date**.

**Production API commit at capture:** `1bc9c43` (later tips: `cd48306`+)  
**UI:** https://web-tawny-iota-56.vercel.app/watchlist  
**Feed:** Alpaca IEX · badge **RTH** · **FEED OK** · **SIGNALS ONLY** · auto-trading **disabled**

Screenshot: `docs/screenshots/phase3-rth-live-watchlist.png`

## Environment

| Check | Result |
|-------|--------|
| Hub running | Yes · ~1393 ticks · cycle ~39–40s · 6/6 pairs |
| Failed scans | 0 |
| Data freshness | Live (not DATA NOT VERIFIED) |
| Session badge | **RTH** |

## Six-stock card snapshot

| Symbol | Status | Price | Trigger | R:R | VWAP | RVOL | 5m | Score | Fake-break | Retest |
|--------|--------|-------|---------|-----|------|------|----|-------|------------|--------|
| QQQ | NO TRADE | 745.64 | 753.63 | 0.59 | WAITING (BELOW) | 1.41x | WAITING | 4/10 | MODERATE | BROKE |
| SPY | NO TRADE | 777.59 | 773.41 | 0.01 | WAITING (ABOVE) | 1.17x | WAITING | 4/10 | HIGH | NONE |
| TSLA | NO TRADE | 379.30 | 370.78 | 0.55 | WAITING (ABOVE) | 0.47x | **FAIL** | 1/10 | HIGH | BROKE |
| NVDA | NO TRADE | 226.43 | 231.58 | 0.72 | PASS (BELOW) | 1.04x | WAITING | 4/10 | NONE | NONE |
| AMD | NO TRADE | 590.88 | 619.05 | 1.79 | WAITING (BELOW) | 1.04x | WAITING | 4/10 | — | — |
| MU | NO TRADE | 992.25 | 1074.94 | 0.27 | PASS (BELOW) | 1.62x | WAITING | 4/10 | — | — |

## Phase 3 behavior checks

| Requirement | Observation |
|-------------|-------------|
| Touch ≠ ENTRY ACTIVE | **PASS** — no ENTRY ACTIVE; all NO TRADE |
| Completed 5m confirmation | **PASS** — WAITING / FAIL shown; TSLA 5m FAIL |
| VWAP / RVOL in decisions | **PASS** — waiting reasons cite VWAP reclaim & RVOL gates |
| Fake-break warnings | **PASS** — SPY/TSLA HIGH, QQQ MODERATE |
| Retest phases | **PASS** — BROKE / NONE visible |
| Min 2R for entry | **PASS** — all R:R &lt; 2; no forced ENTRY ACTIVE |
| Stale → NO TRADE | N/A this sample (data fresh in RTH) |
| Auto-trading | **PASS** — disabled |

## Issues / notes

1. **No ENTRY ACTIVE during this sample** — expected given weak R:R, volume, VWAP, and structure. Continue soaking through the session for confirmation events.
2. Some R:R values look compressed (e.g. SPY 0.01:1) when structure is tight — still correctly blocks entry.
3. IEX volume ≠ consolidated — RVOL gates remain approximate (labeled).

## Verdict

Phase 3 intelligence is **live in production during RTH** and fail-closed correctly. Full ENTRY ACTIVE proof still needs more soak when a high-quality setup appears.
