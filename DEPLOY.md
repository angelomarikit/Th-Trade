# Deploy WULU Scanner — GitHub + Vercel + API host

Logo: `apps/web/public/logo.jpg`

You have **two** deploys:

| Piece | Where | What env |
|-------|--------|----------|
| Web UI | **Vercel** | `VITE_*` only (safe for browser) |
| API | **Railway** (recommended) | Alpaca, Supabase service role, OpenAI, `CORS_ORIGIN`, etc. |

**Never upload `.env` to GitHub.** Copy values from your local `.env` into each dashboard by hand.

---

## Order of operations

1. Push code to GitHub (no `.env`)
2. Deploy **API on Railway** → copy the public URL  
3. Deploy / redeploy **web on Vercel** with `VITE_API_BASE` = that Railway URL  
4. Set Railway `CORS_ORIGIN` = your Vercel URL  

---

## 1. GitHub (if not done)

```powershell
cd "C:\Users\Toptier\Desktop\wulu trading scanner"
git remote add origin https://github.com/YOUR_USER/wulu-trading-scanner.git
git branch -M main
git push -u origin main
```

Confirm `.env` is **not** listed in `git status` before push.

---

## 2. Host the API on Railway (step by step)

### 2.1 Create the service

1. Go to [https://railway.app](https://railway.app) → login with GitHub  
2. **New Project** → **Deploy from GitHub repo** → select `wulu-trading-scanner`  
3. Railway should detect `railway.toml` (build: `npm run build:api`, start: `npm run start:api`)  
4. Open the service → **Settings** → generate a public domain (**Networking** → **Generate Domain**)  
   - Example: `https://wulu-trading-scanner-production.up.railway.app`  
   - Save this — this is your **API URL**

### 2.2 Paste variables from your local `.env`

Railway → your API service → **Variables** → add these (copy values from your PC `.env`):

| Variable | Notes |
|----------|--------|
| `ALPACA_API_KEY_ID` | from `.env` |
| `ALPACA_API_SECRET_KEY` | from `.env` |
| `ALPACA_DATA_BASE_URL` | `https://data.alpaca.markets` |
| `ALPACA_NEWS_BASE_URL` | `https://data.alpaca.markets` |
| `NEWS_PROVIDER` | `mock` or `alpaca` |
| `MARKET_DATA_PROVIDER` | `alpaca` |
| `ALPACA_DATA_FEED` | `iex` |
| `FEATURE_OPTIONS_ENGINE` | `false` |
| `JOURNAL_STORE` | use **`memory`** on Railway (disk is temporary) |
| `SUPABASE_URL` | from `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | from `.env` (server only — never put this on Vercel) |
| `OPENAI_API_KEY` | from `.env` |
| `OPENAI_MODEL` | `gpt-4o-mini` (or your value) |
| `CORS_ORIGIN` | **your Vercel URL** after step 3, e.g. `https://wulu-trading-scanner.vercel.app` |
| `PORT` | leave unset — Railway injects `PORT` automatically |

Optional: `VERIFIED_ACCOUNT_VALUE` if you use position sizing.

After saving variables, Railway redeploys automatically.

### 2.3 Test the API

In a browser open:

`https://YOUR-RAILWAY-DOMAIN/health`

You want `"ok": true`. If it fails, open Railway **Deployments → Logs**.

---

## 3. Deploy the web app on Vercel

1. [https://vercel.com](https://vercel.com) → **Add New Project** → import the same GitHub repo  
2. Build settings:

| Setting | Value |
|---------|--------|
| Install Command | `npm install` |
| Build Command | `npm run build -w @wulu/web` |
| Output Directory | `apps/web/dist` |

3. **Environment Variables** on Vercel (from your `.env` — browser-safe only):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | same as local `VITE_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | same as local `VITE_SUPABASE_ANON_KEY` |
| `VITE_API_BASE` | **Railway API URL** from step 2.1 — **no trailing slash** |

Example: `VITE_API_BASE=https://wulu-trading-scanner-production.up.railway.app`

4. Deploy → copy your Vercel URL (e.g. `https://wulu-xxx.vercel.app`)

5. Go back to Railway → set / update:

`CORS_ORIGIN=https://wulu-xxx.vercel.app`

Redeploy API if needed.

6. If you change `VITE_*` later, you must **Redeploy** Vercel (Vite bakes env into the build).

---

## 4. How the pieces talk

```
Browser (Vercel UI)
   │  uses VITE_API_BASE
   ▼
Railway API  (/health, /v1/setup, …)
   │  CORS_ORIGIN must allow the Vercel domain
   ▼
Alpaca / Supabase / OpenAI
```

Local `.env` is only for your PC. Production reads dashboard variables.

---

## 5. Common mistakes

| Mistake | Fix |
|---------|-----|
| Put whole `.env` on Vercel | Only `VITE_*` on Vercel. Service role + Alpaca + OpenAI → Railway only |
| `VITE_API_BASE` with trailing `/` | Remove trailing slash |
| Forgot to redeploy Vercel after changing `VITE_API_BASE` | Redeploy |
| `CORS_ORIGIN` still `http://localhost:5173` | Set to your real Vercel URL |
| `JOURNAL_STORE=sqlite` on Railway without volume | Use `memory` |
| API URL not public | Generate Domain in Railway Networking |

---

## 6. Local vs production

| | Local | Production |
|--|--------|------------|
| Web | `npm run dev:web` | Vercel |
| API | `npm run dev:api` | Railway |
| Env | `.env` file | Dashboard variables |
| Web→API | Vite proxy (no `VITE_API_BASE` needed) | `VITE_API_BASE` required |

---

## Render alternative (if you prefer Render over Railway)

1. [https://render.com](https://render.com) → **New Web Service** → connect GitHub repo  
2. Build: `npm install && npm run build:api`  
3. Start: `npm run start:api`  
4. Add the same Variables as Railway  
5. Use the Render URL as `VITE_API_BASE` on Vercel  
6. Set `CORS_ORIGIN` to your Vercel URL  
