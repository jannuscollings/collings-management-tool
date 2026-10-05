import { NavLink } from "react-router-dom";
import { Archive, Briefcase, ChevronLeft, ChevronRight, Inbox, Layers3, Settings2, Ticket, UsersRound } from "lucide-react";

import { cn } from "../../lib/cn";
import { useSelector } from "react-redux";
import { DrawerLink, useWorkItemContext } from "../work/WorkItemDrawer";

const groups = [
  {
    label: "Work",
    items: [
      { to: "/home", label: "Home", icon: Inbox },
      { to: "/my-work", label: "My Work", icon: Briefcase },
      { to: "/requests", label: "Requests", icon: Inbox },
    ],
  },
];

const navItemClass = (collapsed) => ({ isActive }) =>
  cn(
    "flex min-h-[42px] min-w-0 items-center gap-2.5 rounded-ds-sm border border-transparent px-3 text-[13px] font-semibold text-copy transition-colors hover:border-brand/20 hover:bg-brand-soft hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
    collapsed && "justify-center px-0",
    isActive && "border-brand/25 bg-brand-soft text-brand-strong"
  );

export default function Sidebar({ collapsed = false, onToggle }) {
  const user = useSelector((state) => state.auth.user);
  const { workspaces, workspaceLoadError, retryWorkspaces } = useWorkItemContext();
  const itemClass = navItemClass(collapsed);

  return (
    <aside className={cn("sticky top-0 hidden h-screen min-w-0 flex-col overflow-y-auto overflow-x-hidden border-r border-line bg-surface py-[18px] shell:flex", collapsed ? "px-3" : "px-4")}>
      <NavLink to="/home" aria-label={collapsed ? "Collings home" : undefined} title={collapsed ? "Collings home" : undefined} className={cn("flex min-h-[53px] items-center gap-3 border-b border-line/70 pb-[18px]", collapsed ? "justify-center" : "px-2.5")}>
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-brand text-sm font-extrabold text-white shadow-[0_4px_13px_rgba(45,200,219,0.26)]">C</span>
        {!collapsed && <span className="text-xl font-medium tracking-[0.2em] text-copy">COLLINGS</span>}
      </NavLink>
      <button type="button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn("mt-2 flex min-h-9 w-full items-center rounded-ds-sm text-muted transition-colors hover:bg-canvas hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand", collapsed ? "justify-center" : "justify-end px-2")}>
        {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
      </button>

      <nav className="mt-1 flex-1" aria-label="Primary navigation">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            {collapsed ? <div className="mb-2 border-t border-line/70" aria-hidden="true" /> :
              <p className="px-2.5 pb-1.5 pt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">{group.label}</p>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"} className={itemClass} aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mb-3">
          <div className={cn("flex items-center justify-between pb-1.5 pt-2", collapsed ? "flex-col gap-2 border-t border-line/70" : "px-2.5")}>
            {!collapsed && <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">Workspaces</p>}
            {user?.is_staff && (
              <DrawerLink drawer="workspaces" className="rounded-ds-xs p-1 text-muted hover:bg-canvas hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="Manage workspaces" title={collapsed ? "Manage workspaces" : undefined}>
                <Settings2 className="h-3.5 w-3.5" />
              </DrawerLink>
            )}
          </div>
          <div className="space-y-1">
            {workspaces.map((workspace) => (
              <NavLink key={workspace.id} to={`/workspaces/${workspace.slug}`} className={itemClass} aria-label={collapsed ? workspace.name : undefined} title={collapsed ? workspace.name : undefined}>
                <Layers3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{workspace.name}</span>}
              </NavLink>
            ))}
            {workspaceLoadError && <button type="button" onClick={retryWorkspaces} aria-label={collapsed ? "Reload workspaces" : undefined} title={collapsed ? "Reload workspaces" : undefined} className={cn("text-left text-xs font-semibold text-brand-strong", collapsed ? "flex min-h-[42px] w-full items-center justify-center" : "px-3 py-2")}>
              {collapsed ? <Layers3 className="h-4 w-4" aria-hidden="true" /> : "Reload workspaces"}
            </button>}
          </div>
        </div>
        {user?.is_staff && <NavLink to="/archive" className={itemClass} aria-label={collapsed ? "Archive" : undefined} title={collapsed ? "Archive" : undefined}>
          <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />{!collapsed && "Archive"}
        </NavLink>}
        {user?.is_staff && <NavLink to="/people" className={itemClass} aria-label={collapsed ? "People" : undefined} title={collapsed ? "People" : undefined}>
          <UsersRound className="h-4 w-4 shrink-0" aria-hidden="true" />{!collapsed && "People"}
        </NavLink>}
        <div className="mb-3">
          {collapsed ? <div className="my-2 border-t border-line/70" aria-hidden="true" /> :
            <p className="px-2.5 pb-1.5 pt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">Demo</p>}
          <NavLink to="/demo" end className={itemClass} aria-label={collapsed ? "Tickets" : undefined} title={collapsed ? "Tickets" : undefined}>
            <Ticket className="h-4 w-4 shrink-0" aria-hidden="true" /> {!collapsed && "Tickets"}
          </NavLink>
        </div>
      </nav>

    </aside>
  );
}
