#!/usr/bin/env node
/**
 * Preview Railway only — raises watchlist cap for Wulu acceptance (not production).
 * Usage: node scripts/railway-set-preview-acceptance-env.mjs
 */
import { execSync } from "node:child_process";

const SERVICE = process.env.RAILWAY_SERVICE ?? "Th-Trade";
const ENV = process.env.RAILWAY_ENVIRONMENT ?? "preview";

const pairs = [
  ["WULU_PREVIEW_DEV_WATCHLIST", "1"],
  ["WULU_ACCEPTANCE_MIN_WATCHLIST", "6"],
  ["WULU_PREVIEW_WATCHLIST_MAX", "12"],
];

for (const [key, value] of pairs) {
  execSync(
    `npx @railway/cli variable set ${key}=${value} --service ${SERVICE} --environment ${ENV}`,
    { stdio: "inherit", encoding: "utf8" },
  );
  console.log(`Set ${key}=${value} on ${SERVICE}/${ENV}`);
}

console.log("Redeploy preview API so variables take effect: npx @railway/cli up --environment preview --service Th-Trade");
