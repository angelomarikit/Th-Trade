# WULU RTH milestone checklist (preview acceptance)

Use this during a **signed-in regular market hours (RTH)** screen recording on the preview deploy only. Production and PR #2 stay unchanged until Wulu approves.

**Preview web:** https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app  
**Preview API:** https://th-trade-preview.up.railway.app  

## Pass criteria (all required before supervised paper trading)

1. **Default six** — TSLA, MU, NVDA, AMD, SPY, QQQ each show price, levels, and status after load / Scan now.
2. **New ticker** — Add a symbol; card moves to SCANNING then a full stock-specific analysis (not generic placeholder).
3. **Chart ↔ recommendation sync** — Level lines and panel levels match the same scan; no long period with moving price and stale levels (refresh should catch up within ~15–25s).
4. **WAIT → ENTER** — ENTER appears only when mandatory confirmations pass, data is fresh, and R:R / geometry gates pass (not on candle movement alone).
5. **MISSED / INVALIDATED** — Correct when price leaves zone or setup breaks; Recent shows **meaningful alerts** only (near active, entry active, missed, invalidated, target/stop).
6. **Targets / stops** — Lifecycle labels update when levels are touched per engine rules.
7. **Desktop + mobile** — Watchlist cards readable without excessive scroll; Scanner usable on narrow viewport.

## Session clarity (premarket vs RTH)

- Premarket: chart may move on extended candles; recommendation stays **not verified** until RTH rules pass.
- RTH with wide/stale quote: **RTH reference price** / DATA NOT VERIFIED — no entry permission from chart alone.

## After pass

- Supervised **paper trading** to measure recommendation performance (still not blind live trading).
- No merge to production until Wulu explicitly approves.
