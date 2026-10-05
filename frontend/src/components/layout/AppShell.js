import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "../../lib/cn";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import MobileNavigation from "./MobileNavigation";
import WorkItemDrawer from "../work/WorkItemDrawer";

export default function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("cmt-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("cmt-sidebar-collapsed", String(sidebarCollapsed));
    } catch {
      // The sidebar remains usable when storage is unavailable.
    }
  }, [sidebarCollapsed]);

  return (
    <WorkItemDrawer>
      <div className={cn(
        "min-h-screen bg-canvas font-product text-ink shell:grid shell:transition-[grid-template-columns] shell:duration-200 motion-reduce:transition-none",
        sidebarCollapsed ? "shell:grid-cols-[72px_minmax(0,1fr)]" : "shell:grid-cols-[250px_minmax(0,1fr)]"
      )}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
        <div className="min-w-0">
          <AppHeader />
          <main id="main-content" className="min-w-0 pb-28 shell:pb-0">
            <Outlet />
          </main>
          <MobileNavigation />
        </div>
      </div>
    </WorkItemDrawer>
  );
}
