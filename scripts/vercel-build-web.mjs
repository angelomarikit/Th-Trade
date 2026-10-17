#!/usr/bin/env node
/**
 * Use when Vercel Root Directory is the repo root and Build Command is:
 *   node scripts/vercel-build-web.mjs
 * Builds @wulu/web with vite only (no tsc — typecheck is npm run typecheck -w @wulu/web).
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execSync("npm run build -w @wulu/web", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: "1" },
});
