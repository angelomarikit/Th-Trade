import { Outlet } from "react-router-dom";
import { useTerminal } from "../../context/TerminalContext";
import { BottomDock } from "./BottomDock";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const { sidebarCollapsed } = useTerminal();

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar />
      <TopBar />
      <main className="workspace">
        <Outlet />
      </main>
      <BottomDock />
      <MobileNav />
    </div>
  );
}
