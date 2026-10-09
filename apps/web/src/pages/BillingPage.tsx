import { useEffect, useState } from "react";
import { fetchPlans, selectPlan, type PlanInfo } from "../lib/accountApi";
import { useAuth } from "../context/AuthContext";

export function BillingPage() {
  const { session, profile, plan, configured, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void fetchPlans()
      .then((r) => setPlans(r.plans.filter((p) => p.id !== "free")))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function onSelect(tier: string) {
    if (!session) return;
    setBusy(tier);
    setError(null);
    try {
      await selectPlan(session, tier);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Subscription</h1>
      <p className="page-sub">
        Choose a plan to unlock Signal Recommendations (live scanner analysis + desk brief). Stripe
        Checkout comes later — for now plans are assigned in-app and reset monthly credits.
      </p>

      <div className="banner info" style={{ marginBottom: "0.85rem" }}>
        Current plan: <strong>{plan?.name ?? profile?.plan_tier ?? "—"}</strong> · Credits{" "}
        <strong>{profile?.credits_balance ?? "—"}</strong>
        {!configured && " · Supabase not configured"}
      </div>

      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}

      <div className="plan-grid">
        {plans.map((p) => {
          const active = profile?.plan_tier === p.id;
          return (
            <article key={p.id} className={`plan-card panel ${active ? "active" : ""}`}>
              <header>
                <h2>{p.name}</h2>
                <p className="plan-price">
                  <span>${p.priceMonthlyUsd}</span>/mo
                </p>
              </header>
              <p className="plan-desc">{p.description}</p>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
                <li>{p.creditsPerMonth.toLocaleString()} credits / month</li>
                <li>
                  Signal unlock {p.aiCreditCost} cr · Deep {p.deepAiCreditCost} cr
                </li>
              </ul>
              <button
                type="button"
                className={active ? "icon-btn primary" : "scan-btn"}
                disabled={!session || busy === p.id || active}
                onClick={() => void onSelect(p.id)}
              >
                {active ? "Current plan" : busy === p.id ? "Updating…" : "Select plan"}
              </button>
            </article>
          );
        })}
      </div>

      <p className="disclaimer" style={{ marginTop: "1rem" }}>
        Ultra Premium ($1,000) reserves team seats / API for the Stripe phase. No live order routing is
        included on any tier.
      </p>
    </div>
  );
}
