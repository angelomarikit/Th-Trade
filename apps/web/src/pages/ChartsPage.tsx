import { Link } from "react-router-dom";
import { CandleChart } from "../components/scanner/CandleChart";
import { useTerminal } from "../context/TerminalContext";

export function ChartsPage() {
  const { bars, barsLoading, barsError, chartTf, setChartTf, symbol, data } = useTerminal();
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
        levels={levels}
        symbol={symbol}
      />
    </div>
  );
}
