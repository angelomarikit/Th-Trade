import { Link } from "react-router-dom";
import { useTerminal } from "../context/TerminalContext";

/** Operator readout. Not part of the customer settings page. */
export function AdminPage() {
  const { health } = useTerminal();

  return (
    <div className="page">
      <h1 className="page-title">Diagnostics</h1>
      <p className="page-sub">
        Backend status for operators. Customers do not need this page.{" "}
        <Link to="/settings">Back to settings</Link>
      </p>

      <div className="panel">
        <div className="panel-h">
          <h3>Service</h3>
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
                <td>OpenAI configured</td>
                <td>{health?.openaiConfigured == null ? "—" : String(health.openaiConfigured)}</td>
              </tr>
              <tr>
                <td>Journal</td>
                <td>
                  {health?.journalEnabled ? "on" : "off"} · {health?.journalCount ?? 0} rows
                </td>
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
              <tr>
                <td>Fast setup</td>
                <td>{String(health?.supportsFastSetup ?? false)}</td>
              </tr>
            </tbody>
          </table>
          <p className="disclaimer">API secrets stay on the server. This page only shows whether a service is configured.</p>
        </div>
      </div>
    </div>
  );
}
