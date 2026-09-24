import { useSelector } from "react-redux";
import { Link, NavLink, Outlet } from "react-router-dom";

import { cn } from "../../lib/cn";
import AccountMenu from "./AccountMenu";
import Sidebar from "./Sidebar";
import WorkItemDrawer, { DrawerLink, useWorkItemContext } from "../work/WorkItemDrawer";

const mobileLinkClass = ({ isActive }) =>
  cn(
    "whitespace-nowrap rounded-ds-sm px-3 py-2 text-xs font-bold text-copy",
    isActive && "bg-brand-soft text-brand-strong"
  );

function MobileHeader() {
  const user = useSelector((state) => state.auth.user);
  const { workspaces } = useWorkItemContext();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur shell:hidden">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4">
        <Link to="/requests" className="font-bold tracking-[0.16em] text-copy">COLLINGS</Link>
        <AccountMenu compact />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Mobile navigation">
        <NavLink to="/my-work" className={mobileLinkClass}>My Work</NavLink>
        <NavLink to="/requests" className={mobileLinkClass}>Requests</NavLink>
        {workspaces.map((workspace) => (
          <NavLink key={workspace.id} to={`/workspaces/${workspace.slug}`} className={mobileLinkClass}>{workspace.name}</NavLink>
        ))}
        {user?.is_staff && <DrawerLink drawer="workspaces" className="whitespace-nowrap rounded-ds-sm px-3 py-2 text-xs font-bold text-copy">Manage workspaces</DrawerLink>}
        <NavLink to="/" end className={mobileLinkClass}>Demo</NavLink>
      </nav>
    </header>
  );
}

export default function AppShell() {

  return (
    <WorkItemDrawer>
    <div className="min-h-screen bg-canvas font-product text-ink shell:grid shell:grid-cols-[250px_minmax(0,1fr)]">
      <Sidebar />
      <div className="min-w-0">
        <MobileHeader />
        <main id="main-content" className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
    </WorkItemDrawer>
  );
}
