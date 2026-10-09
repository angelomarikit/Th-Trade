import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RegisterPage() {
  const { configured, session, signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (session) return <Navigate to="/scanner" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signUp(email.trim(), password, displayName.trim() || undefined);
      setInfo("Account created. If email confirmation is enabled in Supabase, check your inbox — then sign in.");
      navigate("/login");
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
          <div className="brand-mark" />
          <div>
            <strong>WULU SCANNER</strong>
            <span>Create your account</span>
          </div>
        </div>

        {!configured && (
          <div className="banner warn">
            Configure Supabase env vars before registering users.
          </div>
        )}

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!configured || busy}
              placeholder="Optional"
            />
          </label>
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
              autoComplete="new-password"
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
          {info && <p className="banner info">{info}</p>}
          <button type="submit" className="scan-btn" disabled={!configured || busy}>
            {busy ? "Creating…" : "Register"}
          </button>
        </form>

        <p className="auth-foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
