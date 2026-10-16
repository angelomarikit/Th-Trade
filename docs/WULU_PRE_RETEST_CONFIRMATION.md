# Pre-retest confirmation for Wulu

**Preview only** · Production / PR #2 unchanged · **Paper trading not approved**

---

## Your two confirmations

### 1. Bar close when quote is bad — never a “live entry” price

| Rule | Implementation |
|------|----------------|
| Wide/missing bid/ask | Setup may show **last RTH bar close** for **structure only** |
| Label | **“RTH reference price”** badge + quote panel text: *Historical reference… ENTER blocked until quote is verified* |
| Action | **`dataFresh: false`** → status **DATA NOT VERIFIED** (RTH/Premarket when quote fails liquidity) |
| **ENTER** | **`deriveTradingAction`** returns **WAIT** unless `dataFresh === true` and ENTRY ACTIVE + zone executable |

Bar close is **never** treated as a verified executable entry price.

### 2. ENTRY ACTIVE requires ≥2R (conservative) + all mandatory PASS

| Gate | Implementation |
|------|----------------|
| R:R | **Conservative entry** (LONG = top of zone) must be **≥ 2R to T1** for **RISK_REWARD = PASS** |
| Sub-2R in zone after 5m confirms | **RISK_REWARD = FAIL** → state **NO TRADE** — not ENTRY ACTIVE |
| State machine | **ENTRY ACTIVE** only if **`matrix.allRequiredPassed`** and **zone executable** |
| Safety assert | **`assertEntryNotFromNewsAlone`** throws if ENTRY ACTIVE without DATA, LIQUIDITY, 5m, VOL, STRUCTURE, R:R all **PASS** |

Automated tests: `riskReward.entryGate.test.ts`, `stateMachine.test.ts`, `quoteReference.test.ts`

---

## Your workflow checklist (RTH, signed in)

1. **Add ticker** → card appears immediately (**SCANNING** → full analysis).  
2. **Scan now** → stock-specific waiting lines + indicators.  
3. **Indicators** (RSI, EMA, VWAP, volume, structure, 5m) — directional when **verified**; **NOT VERIFIED** when data isn’t.  
4. **Price / trigger / zone / stop / targets** match chart when **verified** (no stale banner).  
5. **WAIT / ENTER / SKIP / INVALIDATED** — ENTER only with **verified live** data.  
6. **Desktop + mobile** — same URL; top search full width on phone.

---

## Preview links

- Watchlist: https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/watchlist  
- Scanner: https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/scanner  
- API health: https://th-trade-preview.up.railway.app/health (`previewDevWatchlist: true`, `effectiveWatchlistMax: 12`)

Hard refresh before testing. Railway + Vercel should reflect branch **`phase7/scanner-v2-preview`** after latest deploy.

---

## If checks pass

Supervised paper trading can be **discussed** — not automatic approval. Until your recording shows the above during RTH, paper trading stays **on hold**.
