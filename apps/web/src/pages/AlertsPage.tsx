import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
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
      <PageHeader
        title="Alerts"
        subtitle="Status changes for symbols you watch. A notification is not permission to enter a trade."
        actions={
          <>
            <span className={`badge ${prefs?.browserEnabled ? "green" : ""}`}>
              {prefs?.browserEnabled ? "Browser ON" : "Browser OFF"}
            </span>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void enableBrowserAlerts()}>
              Enable browser alerts
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void disableBrowserAlerts()}>
              Disable browser
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void refresh()}>
              Refresh
            </button>
          </>
        }
      />

      <p className="page-sub" style={{ marginTop: 0 }}>
        Browser notifications: {prefs?.browserEnabled ? "on" : "off"}. These updates stay inside WULU unless you turn browser alerts on.
      </p>

      {error ? <p className="error-banner">{error}</p> : null}
      {note ? <p className="disclaimer">{note}</p> : null}

      {events.length === 0 ? (
        <EmptyState
          badge="Alerts"
          title="No alerts yet"
          body="Alerts appear only when a symbol’s status changes. If every symbol stays NO TRADE / DATA NOT VERIFIED, this page stays empty on purpose. That is the closed-market freshness rule, not a missing alert feed."
        />
      ) : (
        <div className="panel">
          <div className="panel-h">
            <h3>History ({events.length})</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", padding: "0.55rem 0.75rem" }}>
            {events.map((a) => (
              <div
                key={a.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.55rem 0.65rem",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <strong style={{ fontFamily: "var(--mono)" }}>
                    {a.symbol}
                    {a.side ? ` · ${a.side}` : ""}
                  </strong>
                  <StatusBadge status={a.newStatus} />
                  <span style={{ opacity: 0.75 }}>{ageLabel(Date.parse(a.eventAt))}</span>
                </div>
                <div style={{ marginTop: "0.3rem", fontFamily: "var(--mono)" }}>
                  {a.previousStatus} → <strong>{a.newStatus}</strong>
                </div>
                <div style={{ marginTop: "0.25rem", opacity: 0.8 }}>{a.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
