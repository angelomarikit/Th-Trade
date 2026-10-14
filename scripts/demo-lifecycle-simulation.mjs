/**
 * Milestone 1 — controlled lifecycle proof (no live orders).
 * Run: node scripts/demo-lifecycle-simulation.mjs
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("=== WULU lifecycle simulation (TSLA / MU paths) ===\n");
console.log("Running vitest lifecycleDemo.test.ts …\n");

try {
  execSync("npx vitest run packages/confirmation/tests/lifecycleDemo.test.ts", {
    cwd: root,
    stdio: "inherit",
  });
} catch {
  process.exit(1);
}

console.log("\n--- Manual UI verification (preview, after sign-in) ---");
console.log("1. https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/scanner");
console.log("2. Load TSLA or MU — confirm Your action: WAIT | ENTER | SKIP | INVALIDATED");
console.log("3. Watchlist → Load default six → Recent changes when status shifts");
console.log("4. Signals page → open tracked entries after ENTRY ACTIVE (when live session qualifies)");
console.log("\nProduction unchanged. This script proves state-machine + outcome math only.");
