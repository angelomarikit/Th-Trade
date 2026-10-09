import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { configured, session, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/scanner";

  if (session) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="brand-mark brand-mark-lg" src="/logo.jpg" alt="The Trade — WULU Scanner" width={56} height={56} />
          <div>
            <strong>WULU SCANNER</strong>
            <span>Sign in to your desk</span>
          </div>
        </div>

        {!configured && (
          <div className="banner warn">
            Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code>, then run <code>supabase/schema.sql</code>.
          </div>
        )}

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!configured || busy}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!configured || busy}
            />
          </label>
          {error && (
            <p className="banner error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="scan-btn" disabled={!configured || busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-foot">
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
