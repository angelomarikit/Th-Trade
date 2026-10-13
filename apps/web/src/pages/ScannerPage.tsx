import { CandleChart } from "../components/scanner/CandleChart";
import { SignalSummaryPanel } from "../components/scanner/SignalSummaryPanel";
import { SetupInspector } from "../components/scanner/SetupInspector";
import { SymbolSearch } from "../components/search/SymbolSearch";
import { useTerminal } from "../context/TerminalContext";
import { ageLabel, fmtPct, fmtPrice } from "../lib/format";

export function ScannerPage() {
  const {
    data,
    bars,
    barsLoading,
    barsError,
    chartTf,
    setChartTf,
    symbol,
    error,
    inspectorOpen,
    selectSymbol,
    recentScans,
    loading,
    updatedAt,
  } = useTerminal();

  const lc = data?.liveCard;
  // data is cleared on symbol switch; when present it belongs to current scan.
  const levels = lc
    ? {
        trigger: lc.alertAt,
        zoneLow: lc.entryZone.low,
        zoneHigh: lc.entryZone.high,
        stop: lc.stop,
        t1: lc.t1,
        t2: lc.t2,
        forSymbol: symbol,
      }
    : null;

  const last = lc?.lastPrice ?? bars?.bars.at(-1)?.close;
  const first = bars?.bars[0]?.close;
  const lastBar = bars?.bars.at(-1)?.close;
  const chg =
    first != null && lastBar != null && first !== 0
      ? ((lastBar - first) / first) * 100
      : null;
  const rvol = lc?.relativeMomentum?.rvol;

  return (
    <div className="page scanner-page-v7">
      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}
      {data && (data.liveCard.dataFresh === false || data.card.dataFresh === false) && (
        <p className="banner warn">
          Data not verified / stale — confirmation fail-closed. Session:{" "}
          {data.liveCard.session?.session ?? data.card.session?.session ?? "—"}.
        </p>
      )}

      <div className="scanner-search-hero">
        <SymbolSearch
          initial={symbol}
          size="hero"
          onSelect={(s) => selectSymbol(s, { brief: false })}
        />
      </div>

      <div className={`scanner-layout-v7 ${inspectorOpen ? "with-inspector" : ""}`}>
        <aside className="scanner-recents panel" aria-label="Recent symbols">
          <h3>Recent</h3>
          <ul>
            {recentScans.slice(0, 10).map((r) => (
              <li key={`${r.symbol}-${r.at}`}>
                <button type="button" onClick={() => selectSymbol(r.symbol, { brief: false })}>
                  <strong>{r.symbol}</strong>
                  <span className="muted">{r.status}</span>
                </button>
              </li>
            ))}
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
                {loading && <span className="badge">Updating…</span>}
                {lc?.market && <span className="badge">{lc.market}</span>}
                {lc?.marketRegime && <span className="badge blue">{lc.marketRegime}</span>}
              </div>
              <div className="scanner-price-row">
                <span className="last">{last != null ? fmtPrice(last) : "—"}</span>
                {chg != null && (
                  <span className={`chg ${chg >= 0 ? "up" : "down"}`}>{fmtPct(chg)}</span>
                )}
                <span className="muted">RVOL {rvol != null ? `${rvol.toFixed(2)}x` : "—"}</span>
                <span className="muted">UPD {ageLabel(updatedAt)}</span>
              </div>
            </div>
          </header>

          <CandleChart
            bars={bars?.bars ?? null}
            loading={barsLoading}
            error={barsError}
            timeframe={chartTf}
            onTimeframe={setChartTf}
            levels={levels}
            symbol={symbol}
          />
        </div>

        <SignalSummaryPanel />
        {inspectorOpen && <SetupInspector />}
      </div>
    </div>
  );
}
