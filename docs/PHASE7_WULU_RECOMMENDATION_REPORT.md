# WULU Recommendation System — Preview Completion Report

**Date:** October 15, 2026  
**Scope:** Milestones C → B → A (preview only), chart sync, API verification  
**Branch / commit:** `phase7/scanner-v2-preview` @ **`91d34e0`**  
**Paper trading:** Not enabled (by design)

---

## Executive summary

The **recommendation engine** (matrix, quality score, lifecycle states, stop invalidation logic) is **deployed and responding on preview**. A **customer-facing indicator checklist** (RSI, 9 EMA, VWAP, RVOL, structure, 5m confirmation) is live in the API and wired into the **Scanner** and **Watchlist** UI. **Production and PR #2 were not changed.**

**Remaining gap:** Signed-in **end-to-end UI QA** (desktop + mobile, all chart timeframes) on your side — automated API checks pass; the preview app requires login for Watchlist.

---

## Environments

**Use Vercel links for testing in a browser.** Railway hosts JSON only — opening `https://th-trade-preview.up.railway.app` without a path used to show `{"error":"not found"}`; use the page links in [`PREVIEW_LINKS.md`](./PREVIEW_LINKS.md).

| | Preview | Production |
|---|---------|------------|
| **Web (Scanner / Watchlist)** | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/scanner | Unchanged |
| **API (health / JSON)** | https://th-trade-preview.up.railway.app/health | `https://th-trade-production.up.railway.app` |
| **News** | Alpaca (real headlines) | **mock** (unchanged) |
| **Deploy** | Railway preview only | Not redeployed for this work |

Full page list: [`docs/PREVIEW_LINKS.md`](./PREVIEW_LINKS.md)

---

## Milestone status

### 1. C — Preview API deployment ✅

| Verification | Result |
|--------------|--------|
| `/health` | `ok: true`, `supportsFastSetup: true` |
| Monitor hub | **0 failed scans** last cycle, ~6 symbols/cycle, ~0.8–2s cycle time |
| `matrixChecklist` | **10** gates per `/v1/setup` |
| `qualityScore10` | Present on all six probes |
| `indicatorChecklist` | **6** readings per symbol (bias + explanation) |
| Stop → INVALIDATED | Implemented in setup evaluation + state machine (not live-forced on every ticker this session) |

**Six core symbols (LONG, `fast=1`, latest probe):** all returned `dataFresh: true`, `indicatorLen: 6`, lifecycle mostly **NO TRADE** for this session (expected when mandatory gates fail).

---

### 2. B — Indicator checklist ✅

Each symbol exposes:

| Indicator | Bias values |
|-----------|-------------|
| RSI (14) | BULLISH / BEARISH / NEUTRAL / NOT VERIFIED |
| 9 EMA trend | same |
| VWAP | same |
| Volume / RVOL | same |
| Market structure | same |
| 5-minute confirmation | same |

**UI:** Scanner → “Indicator checklist” section; Watchlist → **Indicators** on each card. Readings are tied to the symbol and the monitor direction (LONG/SHORT).

---

### 3. A — Watchlist recommendation cards ✅

Each card shows without opening the chart:

- **Direction** (LONG/SHORT watch) + **lifecycle status** (WAIT, ENTRY ACTIVE, MISSED, INVALIDATED, NO TRADE, etc.)
- **Verified / not verified** price language
- **Trigger, entry zone, stop, T1–T3**
- **Reward : risk** and **setup score**
- **Strategy** and **what we’re waiting for** (plain English)
- Levels hidden when data is **not verified** or scan errors

---

### 4. Chart ↔ recommendation sync ✅

- Chart **level lines hidden** when setup price vs last candle close diverges **> 0.8%**.
- Banner: “Updating setup levels…”
- Recommendation panel **hides executable level block** when data is unverified or chart/setup are out of sync.
- Poll fix (earlier): bars refresh no longer skips setup refresh (addressed MU price vs levels mismatch).

---

### 5. Integration testing

**Automated (preview API) — passed**

- TSLA, MU, NVDA, AMD, SPY, QQQ: setup + 6 indicators + matrix + quality score.
- Monitor: **0 failures** on latest health check.
- NVDA catalyst (manual curl): real Alpaca/Benzinga headline, verified catalyst flag, **news cannot authorize entry alone**.

**Not completed in automation**

- Logged-in Watchlist “default six” vs Scanner side-by-side.
- All chart timeframes (1m / 5m / 15m / daily) on desktop and mobile.
- Forced live **INVALIDATED** after stop breach on a specific symbol (logic in code; no scripted breach run).

**QA script:** `node scripts/probe-preview-recommendation.mjs`

---

## Safety (unchanged)

- **Signals only** — no automatic orders to Thinkorswim/Alpaca execution.
- Entry still requires **5m confirmation**, **~2R**, **fresh data**, full matrix — not news alone.
- Preview uses **Alpaca IEX**; small vs Thinkorswim differences are expected.

---

## What passed vs needs your review

| Area | Status |
|------|--------|
| Preview API deploy | ✅ |
| Matrix + quality score + indicators in API | ✅ |
| Watchlist + Scanner UI wiring (commit pushed) | ✅ (confirm Vercel build on `91d34e0`) |
| Chart stale / level hiding | ✅ |
| Production isolation | ✅ (`newsProvider: mock`) |
| Full UI walkthrough (6 names × timeframes × mobile) | ⏳ Your sign-in QA |
| Paper trading | ❌ Not started (per your instruction) |

---

## Recommended sign-in checklist (5–10 min)

1. Watchlist → **Load default six** → confirm full text + levels on every card.
2. Pick **MU** and **NVDA** → compare Watchlist **Indicators** vs Scanner checklist.
3. Scanner → switch timeframes; confirm price header matches last candle; no **ENTRY ACTIVE** while “Updating setup…” banner shows.
4. NVDA → confirm catalyst headline is real and relevant.
5. Optional: resize to mobile width — recommendation panel above chart.

---

## Next step (when you’re ready)

After your QA pass, send any **symbol + status + screenshot** mismatches. We can fix those before any paper-trading phase — no new features required to “turn on” the recommendation path on preview.
