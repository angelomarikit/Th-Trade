# Phase 7 frontend — before / after (Wave 1+)

**Branch:** `phase7/frontend-redesign`  
**Production:** still `main` / live Vercel until you approve  

## Before → After

| Area | Before | After (this branch) |
|------|--------|---------------------|
| Search | Tiny TopBar ticker box (max 8 chars) | Global typeahead + Search CTA (ticker or company name) |
| Chart switch | Stale candles/levels possible mid-hop | Clear on switch; abort/seq; symbol-gated levels; VWAP + volume |
| Scanner layout | Crowded header + decision card above squeezed chart | Chart-first workstation: recent · chart · signal panel |
| WAIT copy | Buried in checklist | Plain-English “Why WULU says WAIT” panel |
| Opportunities | Manual run, weak styles, no chart deep-link | Auto-refresh, LONG/SHORT tabs, click symbol → Scanner |
| Navigation | Mixed labels (Live Monitor / Backtesting) | Scanner · Opportunities · Watchlist · Alerts · Performance · Plans |
| Mobile nav | No Alerts | Scanner / Discover / Watch / Alerts / More |
| Design system | Ad-hoc page CSS | Shared `StatusBadge`, `PageHeader`, `DataTable`, `useOpenSymbol` |

## Reused (not rebuilt)
- Setup / bars / opportunities / monitor / alerts / measured-performance APIs  
- Confirmation gates, min 2R, auto-trade off, liveValidated evidence rules  
- lightweight-charts core, TerminalContext hub, Auth, Billing plan economics  

## Not from the reference image (intentionally)
- Fake prices / win rates / $29–$79 plan cards as live data  
- Index ticker strip until we wire a real quotes source  

## Still needs work (next waves)
- Watchlist visual polish + recorded vs delivered alert clarity  
- Billing page visual redesign (same plan prices from API)  
- Full mobile polish + journey QA on device  
- Screenshot pack after preview is live  

## Preview
Open a **Vercel preview** for `phase7/frontend-redesign` (or local `npm run dev:web` against Railway API).  
Do **not** merge to `main` until you sign off the interactive preview.
