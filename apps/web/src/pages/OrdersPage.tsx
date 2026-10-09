import { EmptyState } from "../components/common/EmptyState";

export function OrdersPage() {
  return (
    <div className="page">
      <h1 className="page-title">Orders</h1>
      <p className="page-sub">Order lifecycle UI reserved — no submission or cancellation from Wulu.</p>
      <EmptyState
        badge="Signal only — no order submitted"
        title="Order routing not enabled"
        body="Manual execution is intended on Thinkorswim. Paper/live Alpaca order placement is not implemented and will not be activated by this UI redesign."
      />
    </div>
  );
}
