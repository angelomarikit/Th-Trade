# WULU — Product polish roadmap (Scanner first)

**Date:** 2026-10-13 (UTC+8)  
**Prepared for:** WULU / Angelo  
**Strategy:** Polish the product on **Alpaca Basic (IEX)** first; upgrade to **SIP** later on an already trustworthy UI — not as a substitute for frontend quality.  
**Branch:** `phase7/scanner-v2-preview` · **PR:** https://github.com/angelomarikit/Th-Trade/pull/2  
**Do not merge** until Scanner is approved. Production stays on current `main` until then.

**Preview:** https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app  

**Visual target:** WULU mockup (layout, spacing, chart focus, color hierarchy, professionalism). **Do not** copy mockup example prices, performance stats, or plan prices.

---

## Two separate tracks

| Track | Owner | Notes |
|-------|--------|--------|
| **A. Market data (Alpaca Basic / IEX)** | Alpaca plan + API config | Slower or partial tape vs SIP; RVOL/volume approximations; documented in UI |
| **B. Frontend product quality** | Our team | Design, chart UX, speed, mobile, errors, trust — **in progress on preview** |

Angelo’s direction: **maximize Track B before paying for SIP.**

---

## Already on preview (Track B)

| Item | Status |
|------|--------|
| Chart/header price sync (setup poll + bars co-refresh) | Done |
| Single search bar (no duplicate Scanner hero) | Done |
| Search dropdown only after user types | Done |
| Mobile topbar grid height / badge overlap | Done |
| Chart: patch last candle (less flicker), keep levels until changed | Done |
| Chart: no full-screen loading overlay on background refresh | Done |
| Chart: touch pan / pinch zoom enabled | Done |
| Customer-friendly watchlist limit errors | Done |

---

## Stage 1 — Scanner (current major push)

**Goal:** First-time visitor trusts the product; chart is the hero; LONG / SHORT / WAIT and levels are obvious.

### Layout (mockup-aligned)

- [ ] Desktop: **Watchlist / recent** (left) · **large chart** (center) · **signal + levels** (right)
- [ ] Mobile: stacked, no horizontal scroll; chart is the only pan/zoom surface
- [ ] One global search (TopBar); no passive dropdowns

### Chart experience

- [ ] Larger chart viewport (desktop + mobile)
- [ ] Bigger timeframe controls; readable level labels (TRIG / ENTRY / STOP / T1 / T2 / T3)
- [ ] Fullscreen chart (mobile + desktop)
- [ ] Smooth symbol switch: no stale candles, minimal jump on poll refresh
- [ ] Optional: loading skeleton instead of blank flash

### Signal presentation

- [ ] Clear **LONG / SHORT / WAIT** (color: green / red / yellow)
- [ ] Entry trigger, zone, stop, T1–T3, R:R, setup score at a glance
- [ ] Plain-English “why WULU is waiting” (no matrix dump on first screen)

### Brand & design system (Scanner-only first)

- [ ] WULU logo + wordmark consistent in shell
- [ ] Typography scale (price largest; labels muted)
- [ ] Spacing, cards, buttons, borders — premium dark desk (not debug dashboard)
- [ ] Color rules: green bullish/active · red risk/stop · yellow WAIT · blue info

### Technical / trust

- [ ] No raw JSON, HTTP dumps, or debug strings in customer UI
- [ ] Feed labeled (e.g. IEX) where relevant — honest about Basic plan limits

**Gate:** Angelo approves Scanner on preview → merge PR #2 (or follow-up PR) → then Stage 2.

---

## Stage 2 — Roll design system to other pages

After Scanner approval, same tokens and patterns on:

| Page | Direction |
|------|-----------|
| **Opportunities** | Desktop sortable table; mobile opportunity cards; tap → Scanner |
| **Watchlist** | Simple card: ticker, direction, price, change, status, trigger, score; details collapsed |
| **Alerts** | Notification center (time, symbol, headline); RECORDED vs DELIVERED clear |
| **Performance / Plans** | Same chrome; no fake win rates; real plan economics from API |

---

## Stage 3 — Data upgrade (later)

- [ ] Evaluate Alpaca **SIP** when UI is merge-ready and business approves cost
- [ ] `ALPACA_DATA_FEED=sip` on Railway + entitlement check
- [ ] UI copy update: consolidated tape where applicable

---

## Unchanged (non-negotiable)

- `automaticOrders=false`
- Confirmation rules, min ~2R, liveValidated protections
- No fabricated performance / win-rate marketing

---

## How to review

1. Open **preview** URL (not production).  
2. Scanner: NVDA → TSLA → MU → AMD → NVDA on phone + desktop.  
3. Check: one search, no overlap badges, chart smoothness, levels match header.  
4. Reply with Scanner approval or change list before merge.

---

## Decision log

| Date | Decision |
|------|----------|
| 2026-10-13 | Separate Alpaca limits from frontend polish; Scanner-first; mockup as visual target |
| 2026-10-13 | Continue on `phase7/scanner-v2-preview`; no production merge until Scanner approved |
