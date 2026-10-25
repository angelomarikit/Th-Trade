import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTerminal } from "../context/TerminalContext";
import {
  MOCK_TAPE_DEMO_INTERVAL_MAX_MS,
  MOCK_TAPE_DEMO_INTERVAL_MIN_MS,
  MOCK_TAPE_FAST_INTERVAL_MS,
  mockTapeCadenceLabel,
} from "../lib/mockLiveTape";

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
    mockTapeFastMode,
    setMockTapeFastMode,
    mockTapeDemoIntervalMs,
    setMockTapeDemoIntervalMs,
    chartTf,
    resetMockTrading,
    health,
  } = useTerminal();
  const labTapeControlsOn = mockTradingMode && mockLiveRthMode;
  const tapePreview = mockTapeCadenceLabel(
    chartTf,
    mockTapeFastMode,
    mockTapeDemoIntervalMs,
  );
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
          <fieldset
            className="lab-sim-fieldset"
            disabled={!labTapeControlsOn}
            style={{
              margin: 0,
              padding: "0.65rem 0.75rem",
              border: "1px solid var(--border, rgba(255,255,255,0.12))",
              borderRadius: 8,
              opacity: labTapeControlsOn ? 1 : 0.55,
            }}
          >
            <legend style={{ padding: "0 0.35rem", fontWeight: 600 }}>Lab simulation speed</legend>
            <p className="disclaimer" style={{ margin: "0 0 0.5rem" }}>
              Controls how often the Scanner chart nudges and WAIT/ENTER distance updates. Requires{" "}
              <strong>Lab test data</strong> on (below).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <label>
                <input
                  type="radio"
                  name="mock-tape-cadence"
                  checked={!mockTapeFastMode}
                  onChange={() => setMockTapeFastMode(false)}
                />{" "}
                Real RTH bar timing (1m ≈ 1 min, 5m ≈ 5 min)
              </label>
              <label>
                <input
                  type="radio"
                  name="mock-tape-cadence"
                  checked={mockTapeFastMode}
                  onChange={() => setMockTapeFastMode(true)}
                />{" "}
                Fast demo (adjustable tick speed)
              </label>
            </div>
            <label
              style={{
                display: "block",
                marginTop: "0.65rem",
                opacity: mockTapeFastMode ? 1 : 0.45,
              }}
            >
              <span style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                <span>Tick every</span>
                <strong>{(mockTapeDemoIntervalMs / 1000).toFixed(1)}s</strong>
              </span>
              <input
                type="range"
                min={MOCK_TAPE_DEMO_INTERVAL_MIN_MS}
                max={MOCK_TAPE_DEMO_INTERVAL_MAX_MS}
                step={100}
                value={mockTapeDemoIntervalMs}
                disabled={!mockTapeFastMode}
                onChange={(e) => setMockTapeDemoIntervalMs(Number(e.target.value))}
                style={{ width: "100%", marginTop: "0.35rem" }}
              />
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem",
                marginTop: "0.45rem",
                opacity: mockTapeFastMode ? 1 : 0.45,
              }}
            >
              {[
                { label: "0.5s", ms: 500 },
                { label: "0.8s", ms: MOCK_TAPE_FAST_INTERVAL_MS },
                { label: "1.5s", ms: 1500 },
                { label: "3s", ms: 3000 },
              ].map((p) => (
                <button
                  key={p.ms}
                  type="button"
                  className="icon-btn"
                  disabled={!mockTapeFastMode}
                  onClick={() => setMockTapeDemoIntervalMs(p.ms)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="disclaimer" style={{ margin: "0.55rem 0 0", fontSize: "0.85rem" }}>
              On Scanner ({chartTf} chart): <strong>{tapePreview}</strong>
            </p>
          </fieldset>
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
