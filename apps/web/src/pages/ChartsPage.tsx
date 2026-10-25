import { Link } from "react-router-dom";
import { CandleChart } from "../components/scanner/CandleChart";
import { useTerminal } from "../context/TerminalContext";

export function ChartsPage() {
  const {
    bars,
    barsLoading,
    barsError,
    chartTf,
    setChartTf,
    chartExtendedHours,
    setExtendedHours,
    symbol,
    labTestDataMode,
    mockTradingMode,
    reloadChart,
    scan,
  } = useTerminal();
  return (
    <div className="page">
      <h1 className="page-title">Charts · {symbol}</h1>
      <p className="page-sub">
        Same Alpaca OHLCV feed as Scanner.{" "}
        <Link to="/scanner" style={{ color: "var(--teal)" }}>
          Return to scanner workspace
        </Link>
      </p>
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
        onRetry={() => {
          reloadChart();
          void scan({ ticker: symbol, fast: true });
        }}
      />
    </div>
  );
}
