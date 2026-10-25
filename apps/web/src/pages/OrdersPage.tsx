import { Link } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { useTerminal } from "../context/TerminalContext";
import { fmtPrice, formatEtTime } from "../lib/format";

export function OrdersPage() {
  const { mockTradingMode, mockPortfolio } = useTerminal();

  if (!mockTradingMode) {
    return (
      <div className="page">
        <h1 className="page-title">Orders</h1>
        <p className="page-sub">Order lifecycle UI reserved — no submission or cancellation from Wulu.</p>
        <EmptyState
          badge="Signal only — no order submitted"
          title="Order routing not enabled"
          body="Enable mock trading in Settings to log practice fills on this device only."
        />
        <p style={{ marginTop: "0.75rem" }}>
          <Link to="/settings">Open Settings</Link>
        </p>
      </div>
    );
  }

  const orders = mockPortfolio.orders;

  return (
    <div className="page">
      <h1 className="page-title">Orders</h1>
      <p className="page-sub">Practice order log (local paper — not sent to a broker).</p>
      <p className="banner warn" role="status">
        Mock trading — these are simulated entries/exits only.
      </p>

      {!orders.length ? (
        <EmptyState badge="Paper" title="No practice orders yet" body="Simulate an entry from Scanner." />
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Time (ET)</th>
                <th>Kind</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Sh</th>
                <th>Price</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{formatEtTime(o.at)}</td>
                  <td>{o.kind.toUpperCase()}</td>
                  <td>{o.symbol}</td>
                  <td>{o.side}</td>
                  <td>{o.shares}</td>
                  <td>{fmtPrice(o.price)}</td>
                  <td className="muted">{o.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
