# WULU UI — Sign-off verification (18 Oct 2026)

**From Wulu (after recording `WhatsApp Video 2026-10-18 at 3.52.42 AM.mp4`):**  
Eight visible UI checks **passed**. Chart room, timeframe chips, active state, smoother symbol/TF changes, and **no blank-screen crash** — keep all of this.

**Scope:** Interface polish and verification only. **No trading engine changes.**

| Preview web | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app |
| Preview API | https://th-trade-preview.up.railway.app |

---

## What Wulu asked to finish verifying

| # | Item | How to demonstrate | Expected behavior |
|---|------|--------------------|-------------------|
| 1 | **Pinch zoom + horizontal drag** | Scanner → open chart → pinch in/out → drag left/right | No white crash; **no large empty “future” gap** (only ~3 bars padding after last candle); left edge stops at first bar |
| 2 | **Return to Live** | Scroll/pinch away from newest candles → tap **Return to Live** (mobile label **Live**) | View jumps to latest candles; button shows **active** (teal) when following live |
| 3 | **Bottom nav walkthrough** | Tap each tab: **Scanner**, **Discover**, **Watch**, **Alerts**, **More** | Each screen loads; active tab highlighted; no overlap/clipping |
| 4 | **Build stamp** | Open any signed-in page → read **TopBar** footer line | `web <7-char git sha> · api <7-char sha>` — web should match latest Vercel deploy on `phase7/scanner-v2-preview` |
| 5 | **Chart indicators** | On Scanner chart, use **VWAP / EMA 9 / BB 20 / RSI 14** toggles | Lines hide/show clearly; preference saved on device; price scale stays readable (study lines do not spam last-value labels) |

---

## Mobile bottom nav map

| Label in app | Route | What to show |
|--------------|-------|--------------|
| Scanner | `/scanner` | Symbol search, chart, timeframes, Live, overlays |
| Discover | `/opportunities` | Table loads; subtitle not clipped |
| Watch | `/watchlist` | Monitor cards, spacing |
| Alerts | `/alerts` | History + action buttons usable |
| More | `/settings` | Settings / account entry |

*(Desktop sidebar has additional items — optional for this pass.)*

---

## Recording script (~3–4 min, iPhone)

1. **TopBar** — pause on build stamp (2 s).  
2. **Scanner** — NVDA or MU → **1m → 5m → 15m → 1D** → back to **1m**.  
3. **Pinch + pan** — zoom in, drag to older bars, zoom out slightly.  
4. **Return to Live** — after panning away, tap **Live**.  
5. **Overlays** — turn off **BB 20** and **RSI 14**, then turn back on.  
6. **Watch** → **Discover** → **Alerts** → **More** — one tap each, scroll briefly.  
7. End on **Scanner** again to confirm stability.

---

## Wulu follow-up (18 Oct ~10:43 AM recording)

**Passed (11):** chart framing, TF buttons + active state, multi-symbol switching, charts render, nav sections, Watchlist / Discover / Alerts load, no blank-screen crash.

**Remaining (4) — UI only:**

| # | Item | Engineering response |
|---|------|----------------------|
| 1 | Overlay toggles committed + deployed | `CandleChart` + `wulu.v2.chartOverlays` — each of VWAP / EMA / BB / RSI toggles independently |
| 2 | White RSI line overpowering candles | Display-only: softer RSI color, dotted, lower opacity; RSI pane tucked lower; no calc changes |
| 3 | Return to Live full reset | Resets bar spacing, auto-scale, live viewport + `scrollToRealTime`; covered by `chartViewport.test.ts` |
| 4 | Build stamp on iPhone | TopBar shows **`BUILD webSha · apiSha`** on mobile (full width row) |

After deploy, Wulu should see mobile stamp like **`BUILD abc1234 · c9c7173`** (web SHA from Vercel, api from `/health`).

---

## Engineering notes (preserve — do not regress)

- Chart viewport clamp + error boundary (no invalid logical range crash).  
- `fixLeftEdge` / `fixRightEdge` + small `rightOffset` to limit blank space.  
- Single weekend / unverified messaging (no triple banners).  
- Chart-first layout on mobile; segmented timeframe group.  
- **New:** Indicator overlay toggles on chart toolbar (`CandleChart` + `localStorage` key `wulu.v2.chartOverlays`).

---

## Reply you can send to Wulu

> Thank you for the review and for calling out what’s working — we’re keeping all of those UI improvements as-is (chart size, timeframe clarity, smooth switching, crash fix).  
>  
> For the remaining five items: we added on-chart toggles for VWAP, EMA, Bollinger, and RSI so users can control overlays without touching the engine. Pinch/drag and Return to Live are built for edge clamping and live follow.  
>  
> I’ll send a short follow-up recording that shows pinch/pan, Return to Live, every bottom-nav tab, the TopBar build stamp, and overlay toggles. Scope stays UI verification only until you sign off.

---

*Update the “web sha” row after the next Vercel deploy.*
