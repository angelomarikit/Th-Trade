import { LayoutDashboard, Newspaper, Radar, Settings, Star } from "lucide-react";
import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", end: true, label: "Home", icon: LayoutDashboard },
  { to: "/scanner", label: "Scan", icon: Radar },
  { to: "/watchlist", label: "List", icon: Star },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/settings", label: "More", icon: Settings },
];

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Mobile">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? "active" : undefined)}
        >
          <item.icon size={18} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
