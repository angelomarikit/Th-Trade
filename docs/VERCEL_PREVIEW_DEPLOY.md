# Vercel preview deploy — stuck on old build?

If the build log shows **`tsc --noEmit && vite build`** and errors on `SignalSummaryPanel.tsx` line **93** (`entryGeometry`), Vercel is **not** building current Git.

## What GitHub should have (branch `phase7/scanner-v2-preview`)

- Commit: **`5ee8c1f`** or newer
- [`apps/web/package.json`](../apps/web/package.json): `"build": "vite build"`
- [`SignalSummaryPanel.tsx`](../apps/web/src/components/scanner/SignalSummaryPanel.tsx): imports **`viewLiveCard`**

Verify in browser:  
https://github.com/angelomarikit/Th-Trade/blob/phase7/scanner-v2-preview/apps/web/package.json

## Common mistake: “Redeploy” on an old failed deployment

**Redeploy** re-runs the **same commit** that failed. After pushing fixes to GitHub, create a **new** deployment from branch HEAD (or push an empty commit), not “Redeploy” on a build from `838cd6a` / older.

Your error log proves an old commit if you see:

- `tsc --noEmit && vite build` (current Git uses **`vite build`** only)
- `SignalSummaryPanel.tsx` line **93** = `entryGeometry` (current Git uses **`viewLiveCard`** around line 37+)

## Fix in Vercel dashboard

1. **Project → Settings → Git**
   - Repository: `angelomarikit/Th-Trade`
   - Enable deployments for **`phase7/scanner-v2-preview`** (preview / branch deploys).

2. **Settings → Build & Development**
   - **Build Command**: leave **empty** (use repo [`vercel.json`](../vercel.json)) **or** set exactly:
     ```bash
     cd apps/web && npx vite build
     ```
   - **Remove** any override containing `tsc --noEmit` (that bypasses `package.json`).
   - **Root Directory**: repo root **or** `apps/web` (if `apps/web`, Build Command = `vite build`, Output = `dist`).

3. **Deployments → Redeploy**
   - Select branch **`phase7/scanner-v2-preview`**
   - Commit **`5ee8c1f`** (or latest)
   - Turn on **Clear build cache**

4. **Confirm success**
   - Deployment page shows commit **`5ee8c1f`…**
   - Build log ends with **`vite build`** (no `tsc --noEmit`)

## CLI deploy (optional)

From repo root (after `npx vercel login`):

```bash
npx vercel deploy --prebuilt
# or link project once, then:
cd apps/web && npx vite build && npx vercel deploy --prebuilt
```

Preview URL pattern:  
`https://web-git-phase7-scanner-v2-preview-*.vercel.app`
