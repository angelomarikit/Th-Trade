#!/usr/bin/env node
/**
 * Verify WULU Plan on preview API + optional web bundle hint.
 *
 * Usage:
 *   node scripts/verify-wulu-plan-preview.mjs
 *   EXPECT_GIT_SHA=66ed273 node scripts/verify-wulu-plan-preview.mjs
 */
const API = (process.env.WULU_PREVIEW_API ?? "https://th-trade-preview.up.railway.app").replace(
  /\/+$/,
  "",
);
const EXPECT = (process.env.EXPECT_GIT_SHA ?? "a2d59d1").slice(0, 7);
const TICKER = (process.env.WULU_TICKER ?? "NVDA").toUpperCase();
const SIDE = (process.env.WULU_SIDE ?? "LONG").toUpperCase();

const report = {
  api: API,
  expectedGitPrefix: EXPECT,
  checks: {},
  pass: true,
};

function fail(id, message, detail = undefined) {
  report.checks[id] = { ok: false, message, detail };
  report.pass = false;
}

function pass(id, message, detail = undefined) {
  report.checks[id] = { ok: true, message, detail };
}

try {
  const healthRes = await fetch(`${API}/health`);
  if (!healthRes.ok) {
    fail("health_http", `HTTP ${healthRes.status} from /health`);
  } else {
    const health = await healthRes.json();
    const sha = (health.gitCommit ?? "").slice(0, 7);
    report.checks.health = {
      ok: health.ok === true,
      gitCommit: health.gitCommit,
      openaiConfigured: health.openaiConfigured,
      wuluLabModeEnabled: health.monitor?.wuluLabModeEnabled,
    };
    if (health.ok !== true) fail("health_ok", "/health ok !== true");
    else pass("health_ok", "Preview API is up");

    if (!sha) fail("git_commit", "No gitCommit on /health");
    else if (!sha.startsWith(EXPECT)) {
      fail("git_commit", `Railway still on ${sha}; need ${EXPECT}+ for server tradePlan`, {
        redeploy: "Railway → Th-Trade preview → Deploy branch phase7/scanner-v2-preview",
      });
    } else pass("git_commit", `Deployed commit matches ${EXPECT}+`, { sha });
  }
} catch (err) {
  fail("health_fetch", err instanceof Error ? err.message : String(err));
}

try {
  const postRes = await fetch(`${API}/v1/wulu-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol: TICKER,
      side: SIDE,
      lab: true,
      mockRth: true,
      chart: { timeframe: "5m", bars: [] },
    }),
  });
  if (postRes.status === 404) {
    fail("wulu_plan_post", "POST /v1/wulu-plan missing — redeploy preview Railway");
  } else if (!postRes.ok) {
    fail("wulu_plan_http", `HTTP ${postRes.status} from POST /v1/wulu-plan`);
  } else {
    const body = await postRes.json();
    const tp = body.tradePlan;
    if (tp && typeof tp === "object") {
      pass("wulu_plan_post", "POST /v1/wulu-plan returns tradePlan", {
        briefSource: tp.briefSource,
        tradingAction: tp.tradingAction,
        hasChartRead: Boolean(tp.sections?.chartRead),
        openaiDesk: tp.briefSource === "model",
      });
      if (tp.briefSource !== "model") {
        report.checks.openai_narration = {
          ok: false,
          message: "Plan is rules-only — check OPENAI_API_KEY on Railway",
        };
      } else {
        pass("openai_narration", "WULU desk (OpenAI) narration active");
      }
    } else {
      fail("wulu_plan_body", "POST /v1/wulu-plan missing tradePlan in body");
    }
  }
} catch (err) {
  fail("wulu_plan_fetch", err instanceof Error ? err.message : String(err));
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 2);
