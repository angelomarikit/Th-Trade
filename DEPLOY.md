# Deploy WULU Scanner — GitHub + Vercel

Logo lives at `apps/web/public/logo.jpg` (favicon, sidebar, login/register).

**Important:** Vercel hosts the **web UI** only. The Node API (`apps/api` on port 8787) must run on a separate host (Railway, Render, Fly.io, a VPS). The browser needs `VITE_API_BASE` pointing at that API URL.

---

## 1. Put the project on GitHub

### A. Create the repo (GitHub website)

1. Go to [https://github.com/new](https://github.com/new)
2. Repository name: e.g. `wulu-trading-scanner`
3. Private recommended (API keys stay local)
4. **Do not** add a README / .gitignore (this project already has them)
5. Create repository

### B. Push from your PC (PowerShell)

Open PowerShell in the project folder:

```powershell
cd "C:\Users\Toptier\Desktop\wulu trading scanner"

git status
git remote add origin https://github.com/YOUR_USER/wulu-trading-scanner.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USER` with your GitHub username.

If GitHub asks you to sign in, use a [Personal Access Token](https://github.com/settings/tokens) as the password (or GitHub CLI: `gh auth login`).

**Never commit `.env`** — it is already in `.gitignore`.

---

## 2. Deploy the web app on Vercel

1. Go to [https://vercel.com](https://vercel.com) → Sign in with GitHub
2. **Add New Project** → Import `wulu-trading-scanner`
3. Configure:

| Setting | Value |
|---------|--------|
| Framework Preset | Vite |
| Root Directory | leave blank (repo root) **or** set to `apps/web` (see note) |
| Install Command | `npm install` |
| Build Command | `npm run build -w @wulu/web` |
| Output Directory | `apps/web/dist` |

If you set **Root Directory = `apps/web`**, use:

| Setting | Value |
|---------|--------|
| Install Command | `cd ../.. && npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Preferred for this monorepo: **repo root** + build `-w @wulu/web` + output `apps/web/dist`.

4. **Environment Variables** (Vercel → Project → Settings → Environment Variables):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
| `VITE_API_BASE` | your live API URL, e.g. `https://wulu-api.up.railway.app` (no trailing slash) |

5. Click **Deploy**

After deploy, open the Vercel URL — you should see the **The Trade** logo in the sidebar and as the browser tab icon.

---

## 3. Host the API (required for live scans)

Pick one (example: Railway):

1. Create a new service from the same GitHub repo
2. Root / start: `apps/api` or run `npm run dev:api` / `node` after build
3. Set env vars from `.env.example` (Alpaca, Supabase service role, OpenAI, `CORS_ORIGIN=https://YOUR_VERCEL_APP.vercel.app`, `PORT=8787`)
4. Copy the public HTTPS URL into Vercel’s `VITE_API_BASE`
5. Redeploy Vercel so the frontend rebuilds with that API URL

Until the API is online, the UI will load but scans/health will fail.

---

## 4. Quick checklist

- [ ] Logo files committed: `apps/web/public/logo.jpg`
- [ ] Repo pushed to GitHub
- [ ] Vercel build succeeds (`apps/web/dist`)
- [ ] Supabase env vars set on Vercel
- [ ] API hosted elsewhere + `VITE_API_BASE` set
- [ ] `CORS_ORIGIN` on API allows your Vercel domain
- [ ] No `.env` secrets in GitHub

---

## Local preview of the logo

```powershell
cd "C:\Users\Toptier\Desktop\wulu trading scanner"
npm run dev:web
```

Open http://localhost:5173 — logo in sidebar + `/logo.jpg` in the tab.
