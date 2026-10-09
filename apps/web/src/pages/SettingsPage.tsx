import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTerminal } from "../context/TerminalContext";

export function SettingsPage() {
  const {
    health,
    sidebarCollapsed,
    setSidebarCollapsed,
    inspectorOpen,
    setInspectorOpen,
    bottomDockOpen,
    setBottomDockOpen,
  } = useTerminal();
  const { configured, profile, plan, user, signOut } = useAuth();

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Account, layout preferences, and backend capability readout.</p>

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
                <td>Supabase</td>
                <td>{configured ? "Configured" : "Not configured"}</td>
              </tr>
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
              <tr>
                <td>OpenAI (API)</td>
                <td>{health?.openaiConfigured == null ? "—" : String(health.openaiConfigured)}</td>
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

      <div className="panel" style={{ marginBottom: "0.75rem" }}>
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
          <p className="disclaimer">Preferences persist in localStorage.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>Backend capability</h3>
        </div>
        <div className="tab-body">
          <table className="table">
            <tbody>
              <tr>
                <td>Account environment</td>
                <td>{health?.accountEnvironment ?? "SIGNALS_ONLY"}</td>
              </tr>
              <tr>
                <td>Market data</td>
                <td>
                  {health?.marketDataProvider ?? "—"} · {health?.alpacaFeed ?? "—"}
                </td>
              </tr>
              <tr>
                <td>News</td>
                <td>{health?.newsProvider ?? "—"}</td>
              </tr>
              <tr>
                <td>Alpaca credentials present</td>
                <td>{String(health?.alpacaCredentialsPresent ?? false)}</td>
              </tr>
              <tr>
                <td>Automatic orders</td>
                <td>{String(health?.execution.automaticOrders ?? false)}</td>
              </tr>
              <tr>
                <td>Execution platform</td>
                <td>{health?.execution.platform ?? "thinkorswim"}</td>
              </tr>
              <tr>
                <td>Alpaca role</td>
                <td>{health?.execution.alpacaRole ?? "market_data_and_news"}</td>
              </tr>
              <tr>
                <td>Options engine</td>
                <td>{String(health?.optionsEngine ?? false)}</td>
              </tr>
            </tbody>
          </table>
          <p className="disclaimer">
            API secrets never ship to the browser. Credentials remain server-side in the API process.
          </p>
        </div>
      </div>
    </div>
  );
}
