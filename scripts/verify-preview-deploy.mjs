#!/usr/bin/env node
const API = (process.env.WULU_PREVIEW_API ?? "https://th-trade-preview.up.railway.app").replace(/\/+$/, "");
const EXPECT_COMMIT_PREFIX = (process.env.EXPECT_GIT_SHA ?? "b407a87").slice(0, 7);

const health = await fetch(`${API}/health`).then((r) => r.json());
const ok = health.ok === true;
const sha = (health.gitCommit ?? "").slice(0, 7);
const dev = health.monitor?.previewDevWatchlist === true;
const max = health.monitor?.effectiveWatchlistMax;

console.log(JSON.stringify({ ok, gitCommit: health.gitCommit, previewDevWatchlist: dev, effectiveWatchlistMax: max, supportsFastSetup: health.supportsFastSetup }, null, 2));

if (!ok) process.exit(1);
if (EXPECT_COMMIT_PREFIX && sha && !sha.startsWith(EXPECT_COMMIT_PREFIX)) {
  console.warn(`WARN: live commit ${sha} != expected ${EXPECT_COMMIT_PREFIX} — redeploy preview API`);
  process.exit(2);
}
if (!dev) {
  console.warn("WARN: WULU_PREVIEW_DEV_WATCHLIST not active — run railway-set-preview-acceptance-env.mjs");
  process.exit(3);
}
