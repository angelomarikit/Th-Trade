import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/auth/RequireAuth";
import { AppShell } from "./components/shell/AppShell";
import { AuthProvider } from "./context/AuthContext";
import { TerminalProvider } from "./context/TerminalContext";
import { AlertsPage } from "./pages/AlertsPage";
import { BacktestPage } from "./pages/BacktestPage";
import { BillingPage } from "./pages/BillingPage";
import { ChartsPage } from "./pages/ChartsPage";
import { JournalPage } from "./pages/JournalPage";
import { LoginPage } from "./pages/LoginPage";
import { NewsPage } from "./pages/NewsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PositionsPage } from "./pages/PositionsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ScannerPage } from "./pages/ScannerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignalsPage } from "./pages/SignalsPage";
import { WatchlistPage } from "./pages/WatchlistPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<RequireAuth />}>
            <Route
              element={
                <TerminalProvider>
                  <AppShell />
                </TerminalProvider>
              }
            >
              <Route index element={<OverviewPage />} />
              <Route path="scanner" element={<ScannerPage />} />
              <Route path="watchlist" element={<WatchlistPage />} />
              <Route path="signals" element={<SignalsPage />} />
              <Route path="charts" element={<ChartsPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="positions" element={<PositionsPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="backtest" element={<BacktestPage />} />
              <Route path="news" element={<NewsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
