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

## Preview (production stays on `main`)

**Branch:** `phase7/frontend-redesign` @ `abfca3d`  

1. Open compare/PR: https://github.com/angelomarikit/Th-Trade/compare/main...phase7/frontend-redesign?expand=1  
2. After the PR exists, Vercel’s GitHub integration should post a **Preview** URL on the PR (same pattern as production `web-tawny-iota-56.vercel.app`, but for this branch).  
3. Local fallback:
   ```text
   git checkout phase7/frontend-redesign
   npm run dev:web
   ```
   Point `VITE_API_BASE` at Railway if needed.

CLI deploy from this machine is blocked (Vercel logged out). Please claim the GitHub PR preview or run `vercel login` once.

Do **not** merge to `main` until you sign off the interactive preview.
