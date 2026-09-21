import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { LogOut, Moon, Sun } from "lucide-react";

import api from "../api";
import { logout } from "../store/slices/authSlice";
import { useTheme } from "../contexts/ThemeContext";

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { theme, toggle } = useTheme();
  const [health, setHealth] = useState("…");

  useEffect(() => {
    api
      .get("/api/health/")
      .then((r) => setHealth(r.data.status))
      .catch(() => setHealth("unreachable"));
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="rounded-lg border border-black/10 p-2 dark:border-white/15">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => dispatch(logout())}
            className="flex items-center gap-1 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      <div className="space-y-2 rounded-2xl border border-black/10 p-6 dark:border-white/10">
        <p className="text-sm opacity-70">Signed in as</p>
        <p className="text-lg font-medium">{user?.email}</p>
        <p className="pt-4 text-sm">
          Backend health: <span className="font-mono text-primary">{health}</span>
        </p>
      </div>
    </div>
  );
}
