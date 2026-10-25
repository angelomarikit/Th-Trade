import { Star } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { isSetupChartStale } from "../lib/setupChartSync";
import { CandleChart } from "../components/scanner/CandleChart";
import { SignalSummaryPanel } from "../components/scanner/SignalSummaryPanel";
import { SetupInspector } from "../components/scanner/SetupInspector";
import { TradeSignalBar } from "../components/scanner/TradeSignalBar";
import { TradePlanModalTrigger } from "../components/scanner/TradePlanModal";
import { useTerminal } from "../context/TerminalContext";
import { useOpenSymbol } from "../hooks/useOpenSymbol";
import { fmtCompactVolume, fmtPct, fmtPrice, formatEtTime } from "../lib/format";
import { mockTapeCadenceLabel } from "../lib/mockLiveTape";

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
    chartExtendedHours,
    reloadChart,
    symbol,
    error,
    inspectorOpen,
    setInspectorOpen,
    recentScans,
    loading,
    displayPrice,
    dayChangePct,
    health,
    labTestDataMode,
    setLabTestDataMode,
    mockTradingMode,
    setMockTradingMode,
    mockLiveRthMode,
    scan,
    toggleWatchlist,
    watchlist,
    side,
    setSide,
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
  const starred = watchlist.includes(symbol);
  const sessionBars =
    bars?.symbol?.toUpperCase() === symbol.toUpperCase() ? bars.bars : [];
  const dayStats = useMemo(() => {
    if (!sessionBars.length) return null;
    let hi = -Infinity;
    let lo = Infinity;
    let vol = 0;
    for (const b of sessionBars) {
      hi = Math.max(hi, b.high);
      lo = Math.min(lo, b.low);
      vol += b.volume ?? 0;
    }
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
    return { hi, lo, vol };
  }, [sessionBars]);

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
      {(() => {
        const lines: string[] = [];
        if (labTestDataMode && health?.monitor?.wuluLabModeEnabled) {
          lines.push(
            lc?.labDisclaimer ??
              (lc?.mockEnter
                ? "Mock ENTER lab — paper drill only."
                : "Lab test data — off-RTH diagnostic only. ENTER blocked."),
          );
        }
        if (mockTradingMode) {
          const mockParts = ["Mock trading ON — practice only, no real orders"];
          if (lc?.mockRth) mockParts.push("sim RTH on SIP snapshot");
          if (mockLiveRthMode && labTestDataMode) {
            mockParts.push(`tape ${mockTapeCadenceLabel(chartTf)}`);
          }
          lines.push(mockParts.join(" · "));
        }
        if (lines.length === 0) return null;
        return (
          <div className="banner warn scanner-mode-banner" role="status">
            {lines.map((line, i) => (
              <span key={i} className="scanner-mode-banner-line">
                {line}
              </span>
            ))}
          </div>
        );
      })()}
      {/* Weekend / unverified reason lives once in SignalSummaryPanel (avoids triple banners on mobile). */}

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
              <li key={`${r.symbol}-${r.side}-${r.at}`}>
                <button
                  type="button"
                  onClick={() => openSymbol(r.symbol, { side: r.side, brief: false })}
                >
                  <strong>
                    {r.symbol} · {r.side}
                  </strong>
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

        <div className="trade-signal-bar-slot show-mobile-only">
          <TradeSignalBar />
        </div>

        <div className="scanner-main-v7">
          <header className="scanner-instrument panel">
            <div className="scanner-instrument-body">
              <div className="scanner-instrument-main">
                <div className="scanner-instrument-title">
                  <h1>{symbol}</h1>
                  <button
                    type="button"
                    className={`icon-btn scanner-star show-mobile-only${starred ? " starred" : ""}`}
                    onClick={() => toggleWatchlist(symbol)}
                    title={starred ? "Remove from watchlist" : "Add to watchlist"}
                    aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
                  >
                    <Star size={18} fill={starred ? "currentColor" : "none"} aria-hidden />
                  </button>
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
                      {dayStats && sessionBars.length > 0 ? (
                        <>
                          {sessionBars.at(-1)!.close - sessionBars[0].open >= 0 ? "+" : ""}
                          {fmtPrice(sessionBars.at(-1)!.close - sessionBars[0].open)}{" "}
                        </>
                      ) : null}
                      ({fmtPct(chg)})
                    </span>
                  )}
                  <span className="muted hide-mobile">RVOL {rvol != null ? `${rvol.toFixed(2)}x` : "—"}</span>
                  <span className="muted hide-mobile" title="US Eastern time of the last candle open">
                    Last bar {lastBarAt ?? "—"}
                  </span>
                  <span className="badge blue hide-mobile" title="Alpaca Basic IEX via REST. Not the SIP consolidated feed and not a websocket.">
                    {feedLabel} REST
                  </span>
                  {quoteDiffers && (
                    <span className="muted hide-mobile" title="Latest quote from the setup check. The candle is not changed to this number.">
                      Quote {fmtPrice(quotePx)}
                    </span>
                  )}
                </div>
              </div>
              <div className="scanner-instrument-stats show-mobile-only">
                <span>Volume {fmtCompactVolume(dayStats?.vol)}</span>
                <span>
                  Day range {dayStats ? `${fmtPrice(dayStats.lo)} – ${fmtPrice(dayStats.hi)}` : "—"}
                </span>
                <span>Last update {lastBarAt ?? "—"}</span>
              </div>
            </div>
          </header>

          <TradePlanModalTrigger />

          <CandleChart
            bars={bars?.bars ?? null}
            loading={barsLoading}
            error={barsError}
            timeframe={chartTf}
            onTimeframe={setChartTf}
            symbol={symbol}
            extendedHours={chartExtendedHours}
            onExtendedHours={setExtendedHours}
            chartPreviewMode={labTestDataMode || mockTradingMode}
            labTestDataMode={labTestDataMode}
            labTestDataAvailable={health?.monitor?.wuluLabModeEnabled === true}
            onLabTestDataMode={(on) => {
              setLabTestDataMode(on);
              void scan({ ticker: symbol, brief: false });
            }}
            mockTradingMode={mockTradingMode}
            onMockTradingMode={setMockTradingMode}
            lastPrice={last}
            onRetry={() => {
              reloadChart();
              void scan({ ticker: symbol, fast: true });
            }}
            chartExtras={{
              rvol: rvol ?? null,
              feedLabel,
              quoteNote: quoteDiffers && quotePx != null ? `Quote ${fmtPrice(quotePx)}` : null,
              side,
              onSide: (next) => {
                setSide(next);
                void scan({ ticker: symbol, side: next, brief: false });
              },
            }}
          />
        </div>

        <SignalSummaryPanel />
        {inspectorOpen && <SetupInspector />}
      </div>
    </div>
  );
}
