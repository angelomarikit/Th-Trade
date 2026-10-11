import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/common/EmptyState";
import {
  fetchAlertPreferences,
  fetchMonitorEvents,
  saveAlertPreferencesApi,
  type AlertPreferences,
} from "../lib/api";
import { ageLabel } from "../lib/format";

type ServerEvent = {
  id: string;
  symbol: string;
  side?: string;
  previousStatus: string;
  newStatus: string;
  eventAt: string;
  reason: string;
  dataFresh?: boolean;
};

export function AlertsPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [prefs, setPrefs] = useState<AlertPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const [ev, prefRes] = await Promise.all([
        fetchMonitorEvents(token, 80),
        fetchAlertPreferences(token).catch(() => null),
      ]);
      setEvents(ev.events);
      setNote(ev.note);
      if (prefRes) setPrefs(prefRes.preferences);
      setError(null);

      const browserOn = Boolean(prefRes?.preferences.browserEnabled);
      if (browserOn) {
        for (const e of ev.events.slice(0, 5)) {
          if (seenRef.current.has(e.id)) continue;
          seenRef.current.add(e.id);
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            (e.newStatus.includes("ENTRY ACTIVE") ||
              e.newStatus.includes("CONFIRMATION") ||
              e.newStatus.includes("NEAR ACTIVE") ||
              e.newStatus.includes("INVALIDATED") ||
              e.newStatus.includes("MISSED"))
          ) {
            new Notification(`WULU · ${e.symbol} ${e.side ?? ""}`.trim(), {
              body: `${e.previousStatus} → ${e.newStatus}. ${e.reason}`.slice(0, 180),
              tag: e.id,
            });
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function enableBrowserAlerts() {
    setBusy(true);
    try {
      if (typeof Notification === "undefined") {
        throw new Error("This browser does not support notifications.");
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        throw new Error("Browser notification permission was not granted.");
      }
      const saved = await saveAlertPreferencesApi({ browserEnabled: true, inAppEnabled: true }, token);
      setPrefs(saved.preferences);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function disableBrowserAlerts() {
    setBusy(true);
    try {
      const saved = await saveAlertPreferencesApi({ browserEnabled: false }, token);
      setPrefs(saved.preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Alerts</h1>
      <p className="page-sub">
        Server-recorded monitor status changes (durable when Supabase is configured). Browser
        notifications optional. Email / SMS / push are not wired. Alert ≠ entry permission.
        Automatic trading remains disabled. Signals are not live-validated until RTH testing.
      </p>

      <div className="panel" style={{ marginBottom: "0.75rem" }}>
        <div className="panel-h">
          <h3>Delivery preferences</h3>
          <span className="badge">{prefs?.browserEnabled ? "Browser ON" : "Browser OFF"}</span>
        </div>
        <div className="tab-body" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="scan-btn" disabled={busy} onClick={() => void enableBrowserAlerts()}>
            Enable browser alerts
          </button>
          <button type="button" className="icon-btn" disabled={busy} onClick={() => void disableBrowserAlerts()}>
            Disable browser
          </button>
          <button type="button" className="icon-btn" disabled={busy} onClick={() => void refresh()}>
            Refresh
          </button>
          <span style={{ fontSize: "0.8rem", opacity: 0.85 }}>
            In-app: {prefs?.inAppEnabled === false ? "off" : "on"} · Email/SMS/push: not wired
          </span>
        </div>
      </div>

      {error ? (
        <p style={{ color: "var(--danger, #c44)", fontSize: "0.85rem" }}>{error}</p>
      ) : null}
      {note ? <p className="disclaimer">{note}</p> : null}

      {events.length === 0 ? (
        <EmptyState
          badge="Server log"
          title="No alert events yet"
          body="When monitor status changes (NEAR ACTIVE, CONFIRMATION, ENTRY ACTIVE, MISSED, INVALIDATED, DATA NOT VERIFIED), events appear here and can trigger browser notifications if enabled."
        />
      ) : (
        <div className="panel">
          <div className="panel-h">
            <h3>History ({events.length})</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Symbol</th>
                <th>Transition</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {events.map((a) => (
                <tr key={a.id}>
                  <td>{ageLabel(Date.parse(a.eventAt))}</td>
                  <td>
                    {a.symbol}
                    {a.side ? ` · ${a.side}` : ""}
                  </td>
                  <td>
                    {a.previousStatus} → {a.newStatus}
                  </td>
                  <td>{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
