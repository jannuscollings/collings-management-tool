import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import MobileNavigation from "./MobileNavigation";
import WorkItemDrawer from "../work/WorkItemDrawer";

export default function AppShell() {
  return (
    <WorkItemDrawer>
      <div className="min-h-screen bg-canvas font-product text-ink shell:grid shell:grid-cols-[250px_minmax(0,1fr)]">
        <Sidebar />
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
