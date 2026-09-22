import { useDispatch, useSelector } from "react-redux";
import { NavLink } from "react-router-dom";
import { Inbox, LogOut, Moon, Palette, Sun, Ticket } from "lucide-react";

import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../lib/cn";
import { logout } from "../../store/slices/authSlice";

const groups = [
  {
    label: "Work",
    items: [{ to: "/requests", label: "Requests", icon: Inbox }],
  },
  {
    label: "Workspaces",
    items: [{ to: "/workspaces/creative-design", label: "Creative & Design", icon: Palette }],
  },
  {
    label: "Demo",
    items: [{ to: "/", label: "Tickets", icon: Ticket }],
  },
];

const navItemClass = ({ isActive }) =>
  cn(
    "flex min-h-[42px] items-center gap-2.5 rounded-ds-sm border border-transparent px-3 text-[13px] font-semibold text-copy transition-colors hover:border-brand/20 hover:bg-brand-soft hover:text-brand-strong",
    isActive && "border-brand/25 bg-brand-soft text-brand-strong"
  );

export default function Sidebar() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { theme, toggle } = useTheme();

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
      </nav>

      <div className="border-t border-line pt-4">
        <p className="truncate px-2.5 text-xs font-semibold text-copy">{user?.email}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={toggle} className="flex min-h-[38px] items-center justify-center gap-2 rounded-ds-sm border border-line bg-surface text-xs font-bold text-copy hover:bg-canvas">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Theme
          </button>
          <button onClick={() => dispatch(logout())} className="flex min-h-[38px] items-center justify-center gap-2 rounded-ds-sm border border-line bg-surface text-xs font-bold text-copy hover:bg-canvas">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

