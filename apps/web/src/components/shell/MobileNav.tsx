import { Bell, Radar, Search, Settings, Star } from "lucide-react";
import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/scanner", label: "Scanner", icon: Radar },
  { to: "/opportunities", label: "Discover", icon: Search },
  { to: "/watchlist", label: "Watch", icon: Star },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/settings", label: "More", icon: Settings },
];

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Mobile">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => (isActive ? "active" : undefined)}
        >
          <item.icon size={18} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
