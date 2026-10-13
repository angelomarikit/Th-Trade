import {
  Activity,
  Bell,
  BookOpen,
  CandlestickChart,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  ListOrdered,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  Search,
  Settings,
  Star,
  Wallet,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTerminal } from "../../context/TerminalContext";

/** Primary IA aligned to redesign reference (Performance = measured/backtest hub). */
const PRIMARY = [
  { to: "/scanner", label: "Scanner", icon: Radar },
  { to: "/opportunities", label: "Opportunities", icon: Search },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/backtest", label: "Performance", icon: FlaskConical },
  { to: "/billing", label: "Plans", icon: CreditCard },
];

const ACCOUNT = [
  { to: "/", end: true, label: "Overview", icon: LayoutDashboard },
  { to: "/signals", label: "Signals", icon: Activity },
  { to: "/charts", label: "Charts", icon: CandlestickChart },
  { to: "/positions", label: "Positions", icon: Wallet },
  { to: "/orders", label: "Orders", icon: ListOrdered },
];

const ANALYSIS = [
  { to: "/journal", label: "Trade Journal", icon: BookOpen },
  { to: "/news", label: "News & Catalysts", icon: Newspaper },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useTerminal();

  return (
    <aside className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <img className="brand-mark" src="/logo.jpg" alt="The Trade — WULU Scanner" width={32} height={32} />
        <div className="brand-text">
          <strong>WULU</strong>
          <span>SCANNER</span>
        </div>
      </div>

      <nav className="nav-groups" aria-label="Primary">
        <p className="nav-label">Trading</p>
        {PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            title={item.label}
          >
            <item.icon />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <p className="nav-label">Account</p>
        {ACCOUNT.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={"end" in item ? Boolean((item as { end?: boolean }).end) : undefined}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            title={item.label}
          >
            <item.icon />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <p className="nav-label">Analysis</p>
        {ANALYSIS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            title={item.label}
          >
            <item.icon />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button
          type="button"
          className="icon-btn"
          style={{ width: "100%" }}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
