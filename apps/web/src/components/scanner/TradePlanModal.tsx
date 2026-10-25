import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTerminal } from "../../context/TerminalContext";
import { fetchSetup, type TradePlanPayload } from "../../lib/api";
import { effectiveTradingAction } from "../../lib/effectiveTradingAction";
import { fallbackTradePlanFromLiveCard } from "../../lib/fallbackTradePlan";
import { setupMatchesSelectedSide } from "../../lib/setupSideSync";

export function TradePlanModalTrigger() {
  const { data, symbol, side, loading } = useTerminal();
  const { session } = useAuth();
  const lc = data?.liveCard;
  const aligned = lc && setupMatchesSelectedSide(data, side);
  const action = aligned ? effectiveTradingAction(lc, side) : null;
  const [open, setOpen] = useState(false);

  const hint = !lc
    ? "Scan a symbol first"
    : !aligned
      ? `Rescan ${side} to open plan`
      : `${action} · open WULU Plan for this setup`;

  return (
    <>
      <div className="trade-plan-trigger panel">
        <div className="trade-plan-trigger-copy">
          <strong>WULU Plan for trade</strong>
          <span className="muted">{hint}</span>
        </div>
        <button
          type="button"
          className="scan-btn trade-plan-open-btn"
          disabled={!symbol || loading}
          onClick={() => setOpen(true)}
        >
          WULU Plan
        </button>
      </div>
      {open ? <TradePlanModal onClose={() => setOpen(false)} sessionToken={session?.access_token ?? null} /> : null}
    </>
  );
}

function labFlagsFromTerminal(
  health: { monitor?: { wuluLabModeEnabled?: boolean } } | null | undefined,
  labTestDataMode: boolean,
  mockTradingMode: boolean,
  mockLiveRthMode: boolean,
) {
  const labOk = health?.monitor?.wuluLabModeEnabled === true;
  const useLab = labOk && (labTestDataMode || (mockTradingMode && mockLiveRthMode));
  const useMockRth = useLab && mockLiveRthMode;
  const useMockEnter = useMockRth && mockTradingMode;
  return { lab: useLab, mockRth: useMockRth, mockEnter: useMockEnter };
}

function planSourceLabel(briefSource: TradePlanPayload["briefSource"]): string {
  return briefSource === "model" ? "WULU desk" : "Rules";
}

function TradePlanModal(props: { onClose: () => void; sessionToken: string | null }) {
  const titleId = useId();
  const { symbol, side, health, labTestDataMode, mockTradingMode, mockLiveRthMode, displayPrice } =
    useTerminal();
  const [plan, setPlan] = useState<TradePlanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const flags = labFlagsFromTerminal(
        health,
        labTestDataMode,
        mockTradingMode,
        mockLiveRthMode,
      );
      const res = await fetchSetup(symbol, side, {
        plan: true,
        lab: flags.lab,
        mockRth: flags.mockRth,
        mockEnter: flags.mockEnter,
        accessToken: props.sessionToken,
        timeoutMs: 90_000,
      });
      if (res.tradePlan) {
        setPlan(res.tradePlan);
      } else if (res.liveCard) {
        setPlan(
          fallbackTradePlanFromLiveCard({
            symbol,
            side,
            liveCard: res.liveCard,
            displayPrice,
          }),
        );
      } else {
        throw new Error(
          "WULU Plan unavailable — setup did not return card data. Redeploy preview API (needs commit 84cd395+).",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load WULU Plan.");
    } finally {
      setLoading(false);
    }
  }, [
    health?.monitor?.wuluLabModeEnabled,
    labTestDataMode,
    mockLiveRthMode,
    mockTradingMode,
    displayPrice,
    props.sessionToken,
    side,
    symbol,
  ]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="trade-plan-overlay" role="presentation" onClick={props.onClose}>
      <div
        className="trade-plan-modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="trade-plan-modal-head">
          <div>
            <h2 id={titleId}>
              {symbol} {side} — WULU Plan
            </h2>
            {plan ? (
              <p className="muted trade-plan-modal-sub">
                Engine {plan.tradingAction} · Signal {plan.action} · {planSourceLabel(plan.briefSource)}
              </p>
            ) : null}
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={props.onClose}>
            ×
          </button>
        </header>

        {loading ? (
          <p className="trade-plan-modal-body muted">
            Building WULU Plan from live gates, chart levels, and news…
          </p>
        ) : error ? (
          <div className="trade-plan-modal-body">
            <p className="check-fail">{error}</p>
            <button type="button" className="scan-btn" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : plan ? (
          <div className="trade-plan-modal-body">
            <section className="trade-plan-success panel-inset">
              <h3>Success rate (historical)</h3>
              <p className="trade-plan-success-headline">{plan.successRate.headline}</p>
              <div className="trade-plan-success-grid">
                <div>
                  <label>Win rate</label>
                  <strong>
                    {plan.successRate.winRatePct != null
                      ? `${plan.successRate.winRatePct.toFixed(0)}%`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <label>Sample</label>
                  <strong>{plan.successRate.sampleSize > 0 ? plan.successRate.sampleSize : "—"}</strong>
                </div>
                <div>
                  <label>Expectancy</label>
                  <strong>
                    {plan.successRate.expectancyR != null
                      ? `${plan.successRate.expectancyR.toFixed(2)}R`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <label>Setup score</label>
                  <strong>
                    {plan.successRate.qualityScore10 != null
                      ? `${plan.successRate.qualityScore10}/10`
                      : "—"}
                  </strong>
                </div>
              </div>
              <p className="disclaimer">{plan.successRate.qualityDisclaimer}</p>
              {plan.successRate.strategyName ? (
                <p className="muted">Pattern: {plan.successRate.strategyName}</p>
              ) : null}
            </section>

            <section>
              <h3>Why this zone</h3>
              <p>{plan.sections.whyThisZone}</p>
            </section>

            <section className="trade-plan-do">
              <h3>What to do now</h3>
              <p>{plan.sections.whatToDoNow}</p>
            </section>

            <section>
              <h3>Gates & news</h3>
              <p>{plan.sections.gatesAndNews}</p>
            </section>

            {plan.sections.risks.length > 0 ? (
              <section>
                <h3>Risks</h3>
                <ul className="ai-blockers">
                  {plan.sections.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h3>Outlook</h3>
              <p>{plan.sections.outlook}</p>
            </section>

            <details className="trade-plan-gates-details">
              <summary>Gate checklist</summary>
              <div className="trade-playbook-gates">
                <div>
                  <h4>Passed</h4>
                  {plan.gatesPassed.length === 0 ? (
                    <p className="muted">None</p>
                  ) : (
                    <ul className="signal-checklist">
                      {plan.gatesPassed.map((g) => (
                        <li key={g.label} className="check-pass">
                          {g.label}: {g.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4>Blocking / waiting</h4>
                  {plan.gatesBlocking.length === 0 ? (
                    <p className="muted">None</p>
                  ) : (
                    <ul className="signal-checklist">
                      {plan.gatesBlocking.map((g) => (
                        <li
                          key={g.label}
                          className={g.status === "FAIL" ? "check-fail" : "check-waiting"}
                        >
                          {g.label}: {g.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </details>
          </div>
        ) : null}

        <footer className="trade-plan-modal-foot">
          <p className="disclaimer">Signals only — no orders placed. Not financial advice.</p>
          <button type="button" className="scan-btn" disabled={loading} onClick={() => void load()}>
            Refresh WULU Plan
          </button>
        </footer>
      </div>
    </div>
  );
}
