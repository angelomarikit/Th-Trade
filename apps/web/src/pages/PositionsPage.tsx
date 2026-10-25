import { Link } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { useTerminal } from "../context/TerminalContext";
import { fmtPrice } from "../lib/format";
import { unrealizedPnl } from "../lib/mockTrading";

export function PositionsPage() {
  const {
    mockTradingMode,
    mockPortfolio,
    closeMockPositionById,
    displayPrice,
    symbol,
    setMockTradingMode,
  } = useTerminal();

  if (!mockTradingMode) {
    return (
      <div className="page">
        <h1 className="page-title">Positions</h1>
        <p className="page-sub">Broker position sync is not part of this signals-only build.</p>
        <EmptyState
          badge="Not configured"
          title="No positions feed"
          body="Turn on mock trading in Settings to practice entries locally, or execute manually on Thinkorswim."
        />
        <p style={{ marginTop: "0.75rem" }}>
          <Link to="/settings">Open Settings</Link> and enable mock trading mode.
        </p>
      </div>
    );
  }

  const positions = mockPortfolio.positions;

  return (
    <div className="page">
      <h1 className="page-title">Positions</h1>
      <p className="page-sub">
        Paper portfolio on this device — not connected to Alpaca or any broker.
      </p>
      <p className="banner warn" role="status">
        Mock trading — simulated fills only. Real account unchanged.
      </p>
      <p className="disclaimer">
        Realized P/L (closed):{" "}
        <strong>
          {mockPortfolio.realizedPnl >= 0 ? "+" : ""}${mockPortfolio.realizedPnl.toFixed(2)}
        </strong>
      </p>

      {!positions.length ? (
        <EmptyState
          badge="Paper"
          title="No open practice positions"
          body="Scan a symbol on Scanner, then use Simulate practice entry."
        />
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th>Sh</th>
                <th>Entry</th>
                <th>Mark</th>
                <th>Unrealized</th>
                <th>Stop / T1</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const mark =
                  p.symbol === symbol.toUpperCase() && displayPrice != null
                    ? displayPrice
                    : (p.lastMark ?? p.entryPrice);
                const u = unrealizedPnl(p, mark);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/scanner?symbol=${p.symbol}`}>{p.symbol}</Link>
                    </td>
                    <td>{p.side}</td>
                    <td>{p.shares}</td>
                    <td>{fmtPrice(p.entryPrice)}</td>
                    <td>{fmtPrice(mark)}</td>
                    <td className={u >= 0 ? "level-t1" : "level-stop"}>
                      {u >= 0 ? "+" : ""}${u.toFixed(2)}
                    </td>
                    <td>
                      {fmtPrice(p.stop)} / {fmtPrice(p.t1)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          closeMockPositionById(p.id, mark, "Manual close (paper)");
                        }}
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: "0.75rem" }}>
        <button type="button" className="icon-btn" onClick={() => setMockTradingMode(false)}>
          Turn off mock trading
        </button>
      </p>
    </div>
  );
}
