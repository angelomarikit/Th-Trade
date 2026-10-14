const PREVIEW_WEB =
  process.env.PREVIEW_WEB ??
  "https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app";
const PREVIEW_API = process.env.PREVIEW_API ?? "https://th-trade-preview.up.railway.app";

const webPaths = ["/login", "/", "/scanner", "/watchlist", "/charts"];
const apiPaths = ["/", "/health", "/v1/setup?ticker=SPY&side=LONG&fast=1"];

async function check(label, url, expectJson) {
  const res = await fetch(url, { redirect: "follow" });
  const ct = res.headers.get("content-type") ?? "";
  const okStatus = res.ok;
  let snippet = "";
  if (expectJson) {
    const j = await res.json();
    snippet = JSON.stringify(j).slice(0, 120);
    const good = okStatus && (j.ok === true || j.service === "wulu-api" || j.liveCard);
    console.log(good ? "PASS" : "FAIL", label, res.status, snippet);
    return good;
  }
  const text = await res.text();
  const isHtml = ct.includes("text/html") || text.trimStart().startsWith("<!doctype");
  console.log(okStatus && isHtml ? "PASS" : "FAIL", label, res.status, isHtml ? "HTML" : text.slice(0, 80));
  return okStatus && isHtml;
}

let pass = 0;
let total = 0;
for (const p of webPaths) {
  total++;
  if (await check(`WEB ${p}`, `${PREVIEW_WEB}${p}`, false)) pass++;
}
for (const p of apiPaths) {
  total++;
  if (await check(`API ${p}`, `${PREVIEW_API}${p}`, true)) pass++;
}
console.log(`\n${pass}/${total} checks passed`);
process.exit(pass === total ? 0 : 1);
