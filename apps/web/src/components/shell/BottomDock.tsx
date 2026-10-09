import { useState } from "react";
import { useTerminal } from "../../context/TerminalContext";
import { ageLabel } from "../../lib/format";

export function BottomDock() {
  const { bottomDockOpen, setBottomDockOpen, recentScans, alerts, health } = useTerminal();
  const [tab, setTab] = useState<"scans" | "alerts" | "log">("scans");

  return (
    <footer className={`bottom-dock ${bottomDockOpen ? "" : "closed"}`}>
      <div className="dock-tabs">
        <button type="button" className={tab === "scans" ? "active" : ""} onClick={() => { setTab("scans"); setBottomDockOpen(true); }}>
          Recent scans
        </button>
        <button type="button" className={tab === "alerts" ? "active" : ""} onClick={() => { setTab("alerts"); setBottomDockOpen(true); }}>
          Local alerts
        </button>
        <button type="button" className={tab === "log" ? "active" : ""} onClick={() => { setTab("log"); setBottomDockOpen(true); }}>
          System
        </button>
        <button
          type="button"
          className="icon-btn"
          style={{ marginLeft: "auto", height: 26 }}
          onClick={() => setBottomDockOpen(!bottomDockOpen)}
        >
          {bottomDockOpen ? "Hide" : "Show"}
        </button>
      </div>
      {bottomDockOpen && (
        <div className="dock-body">
          {tab === "scans" && (
            recentScans.length === 0 ? (
              <p className="disclaimer">No scans yet this session.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Status</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.slice(0, 8).map((r) => (
                    <tr key={`${r.symbol}-${r.at}`}>
                      <td>{ageLabel(r.at)}</td>
                      <td>{r.symbol}</td>
                      <td>{r.side}</td>
                      <td>{r.status}</td>
                      <td className="num">{r.score ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {tab === "alerts" && (
            alerts.length === 0 ? (
              <p className="disclaimer">Local in-app alerts only — email/SMS/push not configured.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem" }}>
                {alerts.slice(0, 10).map((a) => (
                  <li key={a.id}>
                    {ageLabel(a.at)} · {a.message}
                  </li>
                ))}
              </ul>
            )
          )}
          {tab === "log" && (
            <p className="disclaimer">
              Phase {health?.phase ?? "—"} · journal {health?.journalEnabled ? "on" : "off"} (
              {health?.journalCount ?? 0}) · execution automaticOrders=
              {String(health?.execution.automaticOrders ?? false)} · Alpaca role{" "}
              {health?.execution.alpacaRole ?? "market_data_and_news"}
            </p>
          )}
        </div>
      )}
    </footer>
  );
}
