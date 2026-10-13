import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "wulu_onboarding_v1_dismissed";

/**
 * First-run launch checklist — signals only, no auto-trade claims.
 */
export function OnboardingChecklist() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <div className="panel" style={{ marginBottom: "1rem" }} role="region" aria-label="Getting started">
      <div className="panel-h">
        <h3>Getting started</h3>
        <button type="button" className="btn" onClick={dismiss}>
          Dismiss
        </button>
      </div>
      <div className="tab-body">
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          WULU is a signals workstation. Automatic trading stays off. Performance stats are{" "}
          <strong>verified signal outcomes</strong> on market data — not your broker P/L.
        </p>
        <ol style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem", fontSize: "0.9rem" }}>
          <li>
            <Link to="/opportunities">Discover</Link> ranked names (ranks ≠ entry permission)
          </li>
          <li>
            <Link to="/watchlist">Promote</Link> up to your plan’s monitor limit for deep
            confirmation
          </li>
          <li>
            <Link to="/alerts">Enable browser alerts</Link> while the tab is open
          </li>
          <li>
            <Link to="/backtest">Backtesting</Link> — LIVE / REPLAY / VALIDATED are kept separate
          </li>
        </ol>
      </div>
    </div>
  );
}
