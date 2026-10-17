#!/usr/bin/env node
/**
 * Sync Alpaca market-data keys from local .env to Railway preview (never prints secrets).
 * Usage: node scripts/railway-fix-alpaca-env.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SERVICE = process.env.RAILWAY_SERVICE ?? "Th-Trade";
const ENV = process.env.RAILWAY_ENVIRONMENT ?? "preview";

function readEnv(name) {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return null;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith(`${name}=`)) continue;
    return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const keyId = readEnv("ALPACA_API_KEY_ID");
const secret = readEnv("ALPACA_API_SECRET_KEY");
const dataBase = readEnv("ALPACA_DATA_BASE_URL");
const feed = readEnv("ALPACA_DATA_FEED");

if (!keyId || !secret) {
  console.log("NO_LOCAL_ALPACA_KEYS: set ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY in .env, then rerun.");
  process.exit(2);
}

execSync(`npx @railway/cli variable set ALPACA_API_KEY_ID --stdin --service ${SERVICE} --environment ${ENV}`, {
  input: keyId,
  stdio: ["pipe", "inherit", "inherit"],
  encoding: "utf8",
});
execSync(
  `npx @railway/cli variable set ALPACA_API_SECRET_KEY --stdin --service ${SERVICE} --environment ${ENV}`,
  {
    input: secret,
    stdio: ["pipe", "inherit", "inherit"],
    encoding: "utf8",
  },
);

const extras = [["MARKET_DATA_AUTH_SOFT_FAIL", "1"]];
if (dataBase?.trim()) extras.push(["ALPACA_DATA_BASE_URL", dataBase.trim()]);
if (feed?.trim()) extras.push(["ALPACA_DATA_FEED", feed.trim()]);

for (const [k, v] of extras) {
  execSync(`npx @railway/cli variable set ${k}=${v} --service ${SERVICE} --environment ${ENV}`, {
    stdio: "inherit",
    encoding: "utf8",
  });
}

console.log(`Alpaca variables updated on ${SERVICE}/${ENV}. Redeploy preview API.`);
