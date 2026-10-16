# Wulu accuracy investigation — spread, R:R, entry geometry, data sync

**For:** Wulu (review) / Angelo (implementation)  
**Production / PR #2:** unchanged  
**Paper trading:** not approved  

---

## 1. Signed-in website (not API-only)

Preview requires **your login** for Watchlist and Scanner. Use the same checklist during **RTH**:

1. Sign in → Watchlist → Load default six → Add AAPL → confirm **SCANNING** then full card.  
2. **Scan now** → all cards refresh.  
3. Scanner → search → **Add to live watchlist** → confirm on Watchlist.  
4. Open chart — action, **entry geometry** line, levels, and last bar must agree when **verified**.  
5. Repeat on phone (same URL).

New UI copy: **entry geometry** (pullback vs above zone) and **quote bid/ask/spread** under indicator details on Scanner.

---

## 2. Spread (TSLA ~10%, MU ~9%) — root cause

**Formula:** `spread% = (ask − bid) / mid × 100` (standard NBBO mid).

**What happened in the after-hours probe:** Alpaca **IEX latest quote** returned bid/ask far apart while the **last regular-hours 5m bar close** was near the structural trigger. That produces double-digit spread **percentages that are real for that quote**, but **not** liquid RTH spreads.

**Fixes shipped:**

| Change | Effect |
|--------|--------|
| Spread **> 2%** → liquidity **FAIL** (not “wait”), reason includes **bid, ask, timestamp** | No more treating 10% as a normal “waiting” liquidity line |
| When spread **> 0.35%**, setup **lastPrice** uses **last completed RTH bar close** instead of quote mid | Price, triggers, and chart align on bar data when quote is unusable |
| Scanner **quote transparency** block | You can audit bid/ask/spread/time vs price basis text |

During **RTH**, expect spreads typically under 0.35% on liquid names; if not, the card explains why.

---

## 3. Risk/reward and ENTRY ACTIVE

**Rule:** ENTRY ACTIVE requires **every required matrix row PASS**, including **RISK_REWARD**.

**Previous gap:** R:R used zone **mid**; could show &lt;2R while wording suggested “waiting.”

**Fix:**

- R:R is computed at **conservative entry** — LONG at **top of zone** (worst fill).  
- If price is **in zone** but conservative R:R **&lt; 2**, row is **FAIL** (“cannot go ENTRY ACTIVE”), not WAITING.  
- State machine already blocks ENTRY ACTIVE without zone executable and without all required PASS (`assertEntryNotFromNewsAlone`).

Tests: `packages/confirmation/tests/riskReward.entryGate.test.ts`

---

## 4. MU $926 vs trigger $913 — pullback vs chase

**Geometry:** LONG trigger/zone are built from **5m structure** (breakout level). If **lastPrice &gt; entry zone high**, the setup is **not** a pullback entry at the trigger.

**UI:** `entryGeometry.summary` — e.g. *“Price is above the entry zone — not a pullback entry at the trigger.”*

**MISSED** only applies after the setup was NEAR/ENTRY and price **left** the zone; extended price without prior active state stays **WAIT** with above-zone messaging.

---

## 5. One snapshot for everything

Each scan builds one **MarketSnapshot** (quote + 1m/5m bars) → matrix, indicators, levels, and chart fetch from the same symbol/timeframe policy. When quotes are unusable, **price basis** text states that levels use **last RTH bar**.

---

## 6. Your RTH retest

Paper trading remains **not approved** until you record a signed-in session showing:

- Verified data on at least two names  
- Stock-specific waiting lines (not identical blocks)  
- Spread sane or clearly explained  
- Above-zone names labeled clearly  
- Chart levels visible and matching when verified  

Preview links unchanged — see `docs/WULU_PREVIEW_E2E_TEST_RESULTS.md`.
