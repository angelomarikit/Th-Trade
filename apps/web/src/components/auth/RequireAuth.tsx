import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function RequireAuth() {
  const { configured, loading, session } = useAuth();
  const location = useLocation();

  if (!configured) {
    return <Outlet />;
  }
  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="disclaimer" style={{ margin: 0 }}>
            Checking session…
          </p>
        </div>
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
