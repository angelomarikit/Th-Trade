import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTerminal } from "../context/TerminalContext";

export function WatchlistPage() {
  const { watchlist, toggleWatchlist, selectSymbol, symbol } = useTerminal();
  const [draft, setDraft] = useState("");
  const navigate = useNavigate();

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim().toUpperCase();
    if (!t) return;
    if (!watchlist.includes(t)) toggleWatchlist(t);
    setDraft("");
  }

  return (
    <div className="page">
      <h1 className="page-title">Watchlist</h1>
      <p className="page-sub">
        Local browser watchlist — also appears as picks in Signal Recommendation. Click a row to
        open Scanner on that symbol.
      </p>

      <form className="scan-controls" onSubmit={onAdd} style={{ marginBottom: "0.85rem" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          placeholder="Add symbol"
          maxLength={8}
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            borderRadius: 8,
            padding: "0.55rem 0.7rem",
            fontFamily: "var(--mono)",
          }}
        />
        <button type="submit" className="scan-btn">
          Add
        </button>
      </form>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Selected</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((s) => (
              <tr
                key={s}
                className="clickable"
                onClick={() => {
                  selectSymbol(s, { brief: true });
                  navigate("/scanner");
                }}
              >
                <td>{s}</td>
                <td>{s === symbol ? "●" : ""}</td>
                <td>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatchlist(s);
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
