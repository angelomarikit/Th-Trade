import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTerminal } from "../context/TerminalContext";

export function SettingsPage() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    inspectorOpen,
    setInspectorOpen,
    bottomDockOpen,
    setBottomDockOpen,
    labTestDataMode,
    setLabTestDataMode,
    mockTradingMode,
    setMockTradingMode,
    mockLiveRthMode,
    setMockLiveRthMode,
    resetMockTrading,
    health,
  } = useTerminal();
  const labServerOn = health?.monitor?.wuluLabModeEnabled === true;
  const { configured, profile, plan, user, signOut } = useAuth();

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Account and layout.</p>

      <div className="panel" style={{ marginBottom: "0.75rem" }}>
        <div className="panel-h">
          <h3>Account</h3>
          <Link to="/billing" className="badge teal">
            Subscription
          </Link>
        </div>
        <div className="tab-body">
          <table className="table">
            <tbody>
              <tr>
                <td>Email</td>
                <td>{user?.email ?? profile?.email ?? "—"}</td>
              </tr>
              <tr>
                <td>Plan</td>
                <td>{plan?.name ?? profile?.plan_tier ?? "—"}</td>
              </tr>
              <tr>
                <td>Credits</td>
                <td>{profile?.credits_balance ?? "—"}</td>
              </tr>
            </tbody>
          </table>
          {configured && user && (
            <button type="button" className="icon-btn" style={{ marginTop: "0.65rem" }} onClick={() => void signOut()}>
              Log out
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>Layout</h3>
        </div>
        <div className="tab-body" style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <label>
            <input
              type="checkbox"
              checked={sidebarCollapsed}
              onChange={(e) => setSidebarCollapsed(e.target.checked)}
            />{" "}
            Collapse sidebar
          </label>
          <label>
            <input
              type="checkbox"
              checked={inspectorOpen}
              onChange={(e) => setInspectorOpen(e.target.checked)}
            />{" "}
            Show setup inspector
          </label>
          <label>
            <input
              type="checkbox"
              checked={bottomDockOpen}
              onChange={(e) => setBottomDockOpen(e.target.checked)}
            />{" "}
            Expand bottom dock
          </label>
          <p className="disclaimer">
            Preferences stay on this device.{" "}
            <Link to="/admin">Diagnostics</Link>
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "0.75rem" }}>
        <div className="panel-h">
          <h3>Mock trading (paper)</h3>
        </div>
        <div className="tab-body" style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <label>
            <input
              type="checkbox"
              checked={mockTradingMode}
              onChange={(e) => setMockTradingMode(e.target.checked)}
            />{" "}
            Mock trading mode
          </label>
          <p className="disclaimer">
            Practice entries and exits on this device only. No broker connection — Alpaca stays data-only.
            Use Scanner → Simulate practice entry, then track under Positions and Orders.
          </p>
          <label style={{ opacity: mockTradingMode ? 1 : 0.65 }}>
            <input
              type="checkbox"
              checked={mockLiveRthMode}
              disabled={!mockTradingMode}
              onChange={(e) => setMockLiveRthMode(e.target.checked)}
            />{" "}
            Simulate live RTH (lab replay)
          </label>
          <p className="disclaimer">
            Replays the last SIP session with <strong>RTH rules and chart</strong> (session badge shows RTH).
            With lab test data on, the <strong>last candle ticks</strong> every ~2.5s so price, chart, and paper
            P/L move like a drill — still not real exchange data.
          </p>
          {mockTradingMode ? (
            <button type="button" className="icon-btn" onClick={() => resetMockTrading()}>
              Reset paper account
            </button>
          ) : null}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "0.75rem" }}>
        <div className="panel-h">
          <h3>Preview testing</h3>
        </div>
        <div className="tab-body" style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <label style={{ opacity: labServerOn ? 1 : 0.65 }}>
            <input
              type="checkbox"
              checked={labTestDataMode}
              disabled={!labServerOn}
              onChange={(e) => setLabTestDataMode(e.target.checked)}
            />{" "}
            Lab test data (off-RTH scans)
          </label>
          <p className="disclaimer">
            {labServerOn
              ? "Uses real SIP bars outside regular hours for diagnostics. ENTER is blocked; cards show LAB TEST. Rescan from Scanner after toggling."
              : "Not enabled on this API — set WULU_LAB_MODE on the preview backend (see Diagnostics)."}
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "0.75rem" }}>
        <div className="panel-h">
          <h3>Alerts & signal history</h3>
          <Link to="/alerts" className="badge teal">
            Alerts
          </Link>
        </div>
        <div className="tab-body">
          <p className="disclaimer" style={{ marginBottom: "0.5rem" }}>
            Turn browser notifications on or off from the Alerts page. A notification is not permission to enter a trade.
          </p>
          <Link to="/signals" className="icon-btn">
            Open Signals & performance
          </Link>
        </div>
      </div>
    </div>
  );
}
