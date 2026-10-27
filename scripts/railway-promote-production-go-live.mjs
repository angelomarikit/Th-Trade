#!/usr/bin/env node
/**
 * Production Railway go-live: SIP feed, Alpaca news, sync keys from .env, redeploy main.
 *
 * Usage:
 *   node scripts/railway-promote-production-go-live.mjs
 *   node scripts/railway-promote-production-go-live.mjs --no-redeploy
 */
import { execSync } from "node:child_process";

const SERVICE = "Th-Trade";
const ENV = "production";
const noRedeploy = process.argv.includes("--no-redeploy");

console.log(`→ Sync Alpaca keys + SIP feed to ${SERVICE}/${ENV}…`);
execSync(`node scripts/railway-fix-alpaca-env.mjs`, {
  stdio: "inherit",
  env: { ...process.env, RAILWAY_SERVICE: SERVICE, RAILWAY_ENVIRONMENT: ENV },
});

const flags = [
  ["NEWS_PROVIDER", "alpaca"],
  ["MARKET_DATA_PROVIDER", "alpaca"],
  ["JOURNAL_STORE", "sqlite"],
  ["WULU_LAB_MODE", "1"],
];

for (const [key, value] of flags) {
  execSync(
    `npx @railway/cli variable set ${key}=${value} --service ${SERVICE} --environment ${ENV}`,
    { stdio: "inherit", encoding: "utf8" },
  );
  console.log(`Set ${key}=${value}`);
}

if (noRedeploy) {
  console.log("Skip redeploy (--no-redeploy). Run:");
  console.log(`  npx @railway/cli redeploy --service ${SERVICE} --environment ${ENV} -y`);
  process.exit(0);
}

const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
console.log(`→ Redeploy ${SERVICE}/${ENV} at ${sha}…`);
execSync(`npx @railway/cli redeploy --service ${SERVICE} --environment ${ENV} -y --commit ${sha}`, {
  stdio: "inherit",
  encoding: "utf8",
});
console.log("Done. Check https://th-trade-production.up.railway.app/health");
