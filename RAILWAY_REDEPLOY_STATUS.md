# Railway Redeploy Status — Blocked on Account Access

**Date:** October 12, 2026  
**Goal:** Redeploy backend with latest Phase 2 monitor (`79cdd7b` / newer) and verify six-stock monitoring live.

---

## Result: NOT COMPLETE — Railway CLI authentication required

I could **not** finish the redeploy from this environment because Railway requires your login (GitHub OAuth / account password). I will not enter your credentials.

### What was verified before the blocker

| Check | Result |
|-------|--------|
| Latest GitHub / local `main` | `79cdd7b` (Phase 2 monitor) + pending health SHA commit |
| Production `GET /v1/monitor` | **HTTP 404** (old backend still live) |
| Production `/health` | OK, Alpaca credentials present, **no `monitor` block** |
| Supabase Phase 2 tables | **Present** (`monitor_watchlists`, `monitor_alert_events`), 0 rows |
| Local tests | **59/59** passed (previous run) |
| Railway CLI | Installed via `npx @railway/cli` — **Unauthorized** |

### What I attempted

1. Started Railway device login (`railway login --browserless`).
2. Opened activation / GitHub OAuth in the browser.
3. Stopped at **“Sign in to GitHub to continue to Railway App”** — needs your account.

Screenshot saved: `railway-login-required.png` (GitHub login for Railway).

---

## What you need to do (≈2 minutes)

**Option A — Authorize the CLI (preferred so I can finish deploy + checks)**

1. Open: https://railway.com/activate  
2. If a fresh code is needed, tell me and I will run `railway login --browserless` again.  
3. Sign in with the GitHub account that owns the `th-trade-production` project.  
4. Reply here: **“Railway authorized”**  
5. I will then: link project → `redeploy --from-source` → verify `/v1/monitor` → auth tests → Live Monitor screenshots → Supabase persist/restore → browser-closed tick test.

**Option B — Redeploy yourself in the Railway dashboard**

1. Open your Railway project → service for `th-trade-production`.  
2. Deployments → ensure source is GitHub repo `angelomarikit/Th-Trade`, branch `main`.  
3. Deploy latest commit (at least `79cdd7b`).  
4. Confirm build uses **Dockerfile** (`railway.toml` already forces this).  
5. After deploy is healthy, reply **“Railway redeployed”** and I will run the verification suite.

**Option C — Provide a Railway API token**

1. Railway → Account Settings → Tokens → create token.  
2. Set locally (do not commit):  
   `RAILWAY_TOKEN=<token>`  
3. Tell me the token is set (or paste only in a secure Cursor secret channel).  
4. I will redeploy and verify without interactive login.

---

## Verification checklist I will run after access

1. `/health` includes `monitor` object (and `gitCommit` if SHA field is live).  
2. `GET /v1/monitor` → 200.  
3. Authenticated `POST /v1/monitor/defaults` loads TSLA, MU, NVDA, AMD, SPY, QQQ.  
4. Live Monitor UI screenshots.  
5. Tick count advances with browser closed.  
6. Row appears in Supabase `monitor_watchlists`.  
7. After Railway restart/redeploy, watchlist restores for that user.

---

## Errors observed

- `railway whoami` / `railway status` → **Unauthorized. Please login with `railway login`**
- Production monitor routes → **404**
- GitHub OAuth page → credentials required (cannot complete without you)

---

## Note on commit hash

You asked specifically for **`79cdd7b`**. That commit contains the Phase 2 monitor. A small follow-up commit exposing `gitCommit` on `/health` may be pushed to make deploy verification easier; either `79cdd7b` or that follow-up is acceptable as long as `/v1/monitor` is live.

---

*Waiting on Railway authorization to continue.*
