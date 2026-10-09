import { EmptyState } from "../components/common/EmptyState";

export function PositionsPage() {
  return (
    <div className="page">
      <h1 className="page-title">Positions</h1>
      <p className="page-sub">Broker position sync is not part of this signals-only build.</p>
      <EmptyState
        badge="Not configured"
        title="No positions feed"
        body="Alpaca is used for market data and news only. Open positions would require an authenticated trading API integration that is deliberately disabled."
      />
    </div>
  );
}
