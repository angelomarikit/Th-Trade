import { useEffect, useRef } from "react";
import { SessionPriceBanner } from "../components/ui/SessionPriceBanner";
import { isSetupChartStale } from "../lib/setupChartSync";
import { viewLiveCard } from "../lib/scannerLiveCardView";
import { CandleChart } from "../components/scanner/CandleChart";
import { SignalSummaryPanel } from "../components/scanner/SignalSummaryPanel";
import { SetupInspector } from "../components/scanner/SetupInspector";
import { useTerminal } from "../context/TerminalContext";
import { useOpenSymbol } from "../hooks/useOpenSymbol";
import { fmtPct, fmtPrice, formatEtTime } from "../lib/format";

export function ScannerPage() {
  const openSymbol = useOpenSymbol();
  const {
    data,
    bars,
    barsLoading,
    barsError,
    chartTf,
    setChartTf,
    extendedHours,
    setExtendedHours,
    symbol,
    error,
    inspectorOpen,
    setInspectorOpen,
    recentScans,
    loading,
    displayPrice,
    dayChangePct,
    health,
    scan,
  } = useTerminal();

  // One signal rail on phone/tablet — inspector duplicates recommendation UI.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1100px)");
    const apply = () => {
      if (mq.matches) setInspectorOpen(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setInspectorOpen]);

  const lc = data?.liveCard;
  const chartClose = bars?.symbol?.toUpperCase() === symbol.toUpperCase() ? bars.bars.at(-1)?.close : null;
  const setupSymbol = lc?.symbol ?? data?.card.symbol ?? null;
  const setupStale = isSetupChartStale({
    symbol,
    setupSymbol,
    barsSymbol: bars?.symbol,
    setupEvaluatedAt: lc?.evaluatedAt ?? data?.card.evaluatedAt ?? null,
    loading,
  });
  const resyncAtRef = useRef(0);
  useEffect(() => {
    if (!setupStale || loading) return;
    const now = Date.now();
    if (now - resyncAtRef.current < 8_000) return;
    resyncAtRef.current = now;
    const id = window.setTimeout(() => {
      void scan({ fast: true, poll: true, refreshBars: true });
    }, 350);
    return () => window.clearTimeout(id);
  }, [setupStale, loading, scan, symbol]);
  const last = displayPrice;
  const sessionLabel = lc?.session?.session ?? data?.card.session?.session;
  const lastBar = bars?.symbol?.toUpperCase() === symbol.toUpperCase() ? bars.bars.at(-1) : undefined;
  const lastBarAt = lastBar ? formatEtTime(lastBar.time * 1000) : null;
  const quotePx = lc?.lastPrice;
  const quoteDiffers =
    sessionLabel === "RTH" &&
    last != null &&
    quotePx != null &&
    Number.isFinite(quotePx) &&
    Math.abs(quotePx - last) / last > 0.001;
  const chg = dayChangePct;
  const rvol = lc?.relativeMomentum?.rvol;
  const feedLabel = (health?.alpacaFeed ?? bars?.feed ?? "iex").toUpperCase();

  return (
    <div className="page scanner-page-v7">
      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}
      {health?.ok && health.supportsFastSetup !== true && (
        <p className="banner warn" role="status">
          Market API is on an older deploy — charts may load slowly until Railway redeploys the latest
          backend (check /health for supportsFastSetup).
        </p>
      )}
      {setupStale && (
        <p className="banner warn" role="status">
          Syncing chart and recommendation — refreshing scan.
        </p>
      )}
      {data ? (
        <SessionPriceBanner
          session={data.liveCard.session?.session ?? data.card.session?.session}
          dataFresh={data.liveCard.dataFresh !== false && data.card.dataFresh !== false}
          referencePriceOnly={
            viewLiveCard(data.liveCard).quoteTransparency?.referencePriceOnly === true
          }
          reason={data.liveCard.dataFreshReason ?? null}
        />
      ) : null}

      {/* Single global search lives in TopBar — no second hero search on Scanner. */}
      <div className={`scanner-layout-v7 ${inspectorOpen ? "with-inspector" : ""}`}>
        <aside className="scanner-recents panel" aria-label="Recent symbols">
          <h3>Recent</h3>
          <ul>
            {recentScans.slice(0, 10).map((r) => {
              const ageMin = Math.floor((Date.now() - r.at) / 60_000);
              const staleScan = ageMin >= 3;
              const unverified = r.dataFresh === false;
              return (
              <li key={`${r.symbol}-${r.at}`}>
                <button type="button" onClick={() => openSymbol(r.symbol, { brief: false })}>
                  <strong>{r.symbol}</strong>
                  <span className={unverified || staleScan ? "recent-stale-label" : "muted"}>
                    {r.status}
                    {staleScan ? ` · scan ${ageMin}m ago` : ""}
                    {unverified ? " · tap to refresh" : ""}
                  </span>
                </button>
              </li>
            );
            })}
            {recentScans.length === 0 && (
              <li className="muted" style={{ padding: "0.5rem 0.65rem" }}>
                Search a ticker to begin
              </li>
            )}
          </ul>
        </aside>

        <div className="scanner-main-v7">
          <header className="scanner-instrument panel">
            <div>
              <div className="scanner-instrument-title">
                <h1>{symbol}</h1>
                {/* Status chips: TopBar on mobile; desktop duplicates session/feed here */}
                <div className="scanner-instrument-meta hide-mobile">
                  {loading && <span className="badge">Updating…</span>}
                  {sessionLabel && <span className="badge amber">{sessionLabel}</span>}
                  <span className="badge blue" title="Market data feed">
                    {feedLabel}
                  </span>
                  {lc?.marketRegime && <span className="badge">{lc.marketRegime}</span>}
                </div>
              </div>
              <div className="scanner-price-row">
                <span className="last" title="Regular-session close. The chart stops at 16:00 ET and does not include after-hours prints.">
                  {last != null ? fmtPrice(last) : "—"}
                </span>
                {chg != null && (
                  <span className={`chg ${chg >= 0 ? "up" : "down"}`} title="Session change from setup">
                    {fmtPct(chg)}
                  </span>
                )}
                <span className="muted">RVOL {rvol != null ? `${rvol.toFixed(2)}x` : "—"}</span>
                <span className="muted" title="US Eastern time of the last candle open">
                  Last bar {lastBarAt ?? "—"}
                </span>
                <span className="badge blue" title="Alpaca Basic IEX via REST. Not the SIP consolidated feed and not a websocket.">
                  {feedLabel} REST
                </span>
                {quoteDiffers && (
                  <span className="muted" title="Latest quote from the setup check. The candle is not changed to this number.">
                    Quote {fmtPrice(quotePx)}
                  </span>
                )}
              </div>
            </div>
          </header>

          <CandleChart
            bars={bars?.bars ?? null}
            loading={barsLoading}
            error={barsError}
            timeframe={chartTf}
            onTimeframe={setChartTf}
            symbol={symbol}
            extendedHours={extendedHours}
            onExtendedHours={setExtendedHours}
            lastPrice={last}
            onRetry={() => void scan({ ticker: symbol, fast: true })}
          />
        </div>

        <SignalSummaryPanel />
        {inspectorOpen && <SetupInspector />}
      </div>
    </div>
  );
}
