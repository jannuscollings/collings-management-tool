import { NavLink } from "react-router-dom";
import { Briefcase, Inbox, Layers3, Settings2, Ticket } from "lucide-react";

import { cn } from "../../lib/cn";
import { useSelector } from "react-redux";
import { DrawerLink, useWorkItemContext } from "../work/WorkItemDrawer";
import AccountMenu from "./AccountMenu";

const groups = [
  {
    label: "Work",
    items: [
      { to: "/my-work", label: "My Work", icon: Briefcase },
      { to: "/requests", label: "Requests", icon: Inbox },
    ],
  },
];

const navItemClass = ({ isActive }) =>
  cn(
    "flex min-h-[42px] items-center gap-2.5 rounded-ds-sm border border-transparent px-3 text-[13px] font-semibold text-copy transition-colors hover:border-brand/20 hover:bg-brand-soft hover:text-brand-strong",
    isActive && "border-brand/25 bg-brand-soft text-brand-strong"
  );

export default function Sidebar() {
  const user = useSelector((state) => state.auth.user);
  const { workspaces } = useWorkItemContext();

  return (
    <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-line bg-surface px-4 py-[18px] shell:flex">
      <NavLink to="/requests" className="flex items-center gap-3 border-b border-line/70 px-2.5 pb-[18px]">
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-brand text-sm font-extrabold text-white shadow-[0_4px_13px_rgba(45,200,219,0.26)]">C</span>
        <span className="text-xl font-medium tracking-[0.2em] text-copy">COLLINGS</span>
      </NavLink>

      <nav className="mt-3 flex-1" aria-label="Primary navigation">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-2.5 pb-1.5 pt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navItemClass}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mb-3">
          <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">Workspaces</p>
            {user?.is_staff && (
              <DrawerLink drawer="workspaces" className="rounded-ds-xs p-1 text-muted hover:bg-canvas hover:text-copy" aria-label="Manage workspaces">
                <Settings2 className="h-3.5 w-3.5" />
              </DrawerLink>
            )}
          </div>
          <div className="space-y-1">
            {workspaces.map((workspace) => (
              <NavLink key={workspace.id} to={`/workspaces/${workspace.slug}`} className={navItemClass}>
                <Layers3 className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{workspace.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
        <div className="mb-3">
          <p className="px-2.5 pb-1.5 pt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">Demo</p>
          <NavLink to="/" end className={navItemClass}>
            <Ticket className="h-4 w-4" aria-hidden="true" /> Tickets
          </NavLink>
        </div>
      </nav>

      <div className="border-t border-line pt-4">
        <AccountMenu />
      </div>
    </aside>
  );
}
