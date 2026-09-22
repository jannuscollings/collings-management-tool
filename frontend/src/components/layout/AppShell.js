import { useDispatch } from "react-redux";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";

import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../lib/cn";
import { logout } from "../../store/slices/authSlice";
import Sidebar from "./Sidebar";

const mobileLinkClass = ({ isActive }) =>
  cn(
    "whitespace-nowrap rounded-ds-sm px-3 py-2 text-xs font-bold text-copy",
    isActive && "bg-brand-soft text-brand-strong"
  );

export default function AppShell() {
  const dispatch = useDispatch();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-canvas font-product text-ink shell:grid shell:grid-cols-[250px_minmax(0,1fr)]">
      <Sidebar />
      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur shell:hidden">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4">
            <Link to="/requests" className="font-bold tracking-[0.16em] text-copy">COLLINGS</Link>
            <div className="flex items-center gap-1">
              <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-ds-xs text-copy hover:bg-canvas" aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button onClick={() => dispatch(logout())} className="grid h-9 w-9 place-items-center rounded-ds-xs text-copy hover:bg-canvas" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Mobile navigation">
            <NavLink to="/requests" className={mobileLinkClass}>Requests</NavLink>
            <NavLink to="/workspaces/creative-design" className={mobileLinkClass}>Creative &amp; Design</NavLink>
            <NavLink to="/" end className={mobileLinkClass}>Demo</NavLink>
          </nav>
        </header>
        <main id="main-content" className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

