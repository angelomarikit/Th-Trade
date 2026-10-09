import { BelowChartTabs } from "../components/scanner/BelowChartTabs";
import { CandleChart } from "../components/scanner/CandleChart";
import { DecisionCard } from "../components/scanner/DecisionCard";
import { InstrumentHeader } from "../components/scanner/InstrumentHeader";
import { SetupInspector } from "../components/scanner/SetupInspector";
import { useTerminal } from "../context/TerminalContext";

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
  } = useTerminal();

  const lc = data?.liveCard;
  const levels = lc
    ? {
        trigger: lc.alertAt,
        zoneLow: lc.entryZone.low,
        zoneHigh: lc.entryZone.high,
        stop: lc.stop,
        t1: lc.t1,
        t2: lc.t2,
      }
    : null;

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100%", paddingBottom: 0 }}>
      {error && (
        <p className="banner error" role="alert" style={{ marginBottom: "0.65rem" }}>
          {error}
        </p>
      )}
      {data && (data.liveCard.dataFresh === false || data.card.dataFresh === false) && (
        <p className="banner warn" style={{ marginBottom: "0.65rem" }}>
          Data not verified / stale — confirmation fail-closed. Session:{" "}
          {data.liveCard.session?.session ?? data.card.session?.session ?? "—"}.
        </p>
      )}

      <div className={`scanner-layout ${inspectorOpen ? "" : "no-inspector"}`} style={{ flex: 1, minHeight: 0 }}>
        <div className="scanner-main">
          <InstrumentHeader />
          <DecisionCard />
          <CandleChart
            bars={bars?.bars ?? null}
            loading={barsLoading}
            error={barsError}
            timeframe={chartTf}
            onTimeframe={setChartTf}
            levels={levels}
            symbol={symbol}
          />
          <BelowChartTabs />
        </div>
        {inspectorOpen && <SetupInspector />}
      </div>
    </div>
  );
}
