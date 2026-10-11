# Railway Redeploy Verification Report

**Date:** October 12, 2026  
**Result:** SUCCESS — Phase 2 multi-stock monitor is live on production

---

## 1. Deploy

| Item | Value |
|------|--------|
| Railway project | `discerning-warmth` |
| Service | `Th-Trade` → `th-trade-production.up.railway.app` |
| **Previous live commit** | `4a64ffe` (stuck since Oct 9 — why monitor was 404) |
| **New live commit** | **`79cdd7b76ac5730815f10941f7c2e8fcc2370e46`** |
| Deploy method | `railway redeploy --from-source` |
| Deploy status | **SUCCESS** |
| Auto-trading | Still disabled |

### Logs (startup excerpt)

- `Wulu API (Phase G) on http://localhost:8080`
- Alpaca credentials present (`yes` / `yes`)
- Supabase configured
- Endpoints include `GET /v1/monitor`, `POST /v1/monitor/defaults`, etc.

---

## 2. API verification

| Check | Result |
|-------|--------|
| `/health` includes `monitor` | **PASS** |
| `GET /v1/monitor` | **200** (was 404) |
| Authenticated `POST /v1/monitor/defaults` | **PASS** — loaded TSLA, MU, NVDA, AMD, SPY, QQQ |
| Monitor running | **True** |
| Sample cycle time | ~340–417 ms (hub) after warm-up |

Statuses during verification: **DATA NOT VERIFIED** for all six (expected — weekend / fail-closed). Prices still returned from Alpaca history.

---

## 3. Browser-closed monitoring

| Check | Result |
|-------|--------|
| Tick before wait | `tickCount = 1` |
| After ~25s (no browser dependence) | `tickCount = 3` |
| Verdict | **PASS** — hub keeps scanning while API process is up |

---

## 4. Supabase persistence + restart restore

| Check | Result |
|-------|--------|
| Row in `monitor_watchlists` after defaults | **1 row** with all six symbols |
| Railway `restart` | Triggered |
| After restart, authenticated `GET /v1/monitor` | **Restored TSLA, MU, NVDA, AMD, SPY, QQQ** · `running=True` |
| Verdict | **PASS** |

---

## 5. Live Monitor UI

- Signed in on https://web-tawny-iota-56.vercel.app/watchlist  
- Board title: **WULU LIVE WATCHLIST**  
- Status: **RUNNING** · Ranked opportunities **6/6**  
- Cards show prices, triggers, VWAP/RVOL/5m, quality scores  
- Feed badge: **FEED OK**  
- All cards: **DATA NOT VERIFIED — NO ACTIONABLE SIGNAL** (correct for weekend)

Screenshot: `live-watchlist-six-stocks.png`

---

## 6. Errors / notes

| Issue | Severity | Notes |
|-------|----------|--------|
| Stuck deploy on `4a64ffe` | Fixed | GitHub pushes were not auto-deploying; forced `--from-source` |
| Alpaca HTTP **429** on some symbols during heavy testing | Low | Rate limit under burst; fail-closed keeps DATA NOT VERIFIED |
| Weekend freshness | Expected | No ENTRY ACTIVE from stale/weekend data |

---

## 7. Verdict checklist

| Requirement | Status |
|-------------|--------|
| Redeploy latest Phase 2 commit | **DONE** (`79cdd7b`) |
| Monitor endpoints working | **DONE** |
| Railway logs confirm new build | **DONE** |
| Auth + load default six | **DONE** |
| Live Monitor UI | **DONE** (screenshot) |
| Continues when browser closed | **DONE** |
| Supabase save | **DONE** |
| Restore after server restart | **DONE** |

**Ready for Phase 3** after leadership review of this report.
