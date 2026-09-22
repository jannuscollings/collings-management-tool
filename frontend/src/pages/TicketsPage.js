import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { LogOut, Moon, Plus, Sun, Trash2 } from "lucide-react";

import { PRIORITY_OPTIONS, STATUS_OPTIONS, ticketsApi } from "../api/tickets";
import { logout } from "../store/slices/authSlice";
import { useTheme } from "../contexts/ThemeContext";

const PRIORITY_STYLES = {
  low: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  medium: "bg-amber-200 text-amber-800 dark:bg-amber-700/40 dark:text-amber-200",
  high: "bg-red-200 text-red-800 dark:bg-red-700/40 dark:text-red-200",
};

export default function TicketsPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { theme, toggle } = useTheme();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await ticketsApi.list();
      setTickets(data);
    } catch {
      toast.error("Couldn't load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { data } = await ticketsApi.create({ title: title.trim(), priority });
      setTickets((t) => [data, ...t]);
      setTitle("");
      setPriority("medium");
      toast.success("Ticket created");
    } catch {
      toast.error("Couldn't create ticket");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id, status) => {
    const prev = tickets;
    setTickets((t) => t.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      await ticketsApi.update(id, { status });
    } catch {
      setTickets(prev);
      toast.error("Couldn't update status");
    }
  };

  const remove = async (id) => {
    const prev = tickets;
    setTickets((t) => t.filter((x) => x.id !== id));
    try {
      await ticketsApi.remove(id);
    } catch {
      setTickets(prev);
      toast.error("Couldn't delete ticket");
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tickets</h1>
          <p className="text-sm opacity-60">{user?.email}</p>
        </div>
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

      <Link
        to="/workspaces/creative-design"
        className="mb-6 block rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm transition hover:bg-primary/15"
      >
        <span className="font-semibold">Open Creative &amp; Design workspace</span>
        <span className="mt-1 block opacity-70">View and manage the new work-item domain.</span>
      </Link>
      <Link
        to="/requests"
        className="mb-6 block rounded-xl border border-black/10 p-4 text-sm transition hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
      >
        <span className="font-semibold">Open Requests</span>
        <span className="mt-1 block opacity-70">Submit, triage and accept incoming work.</span>
      </Link>

      <form onSubmit={create} className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New ticket title…"
          className="flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/15"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
        >
          {PRIORITY_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary transition hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm opacity-60">Loading…</p>
      ) : tickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm opacity-60 dark:border-white/15">
          No tickets yet. Create your first one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium
                }`}
              >
                {t.priority}
              </span>
              <span className="flex-1 truncate text-sm">{t.title}</span>
              <select
                value={t.status}
                onChange={(e) => changeStatus(t.id, e.target.value)}
                className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/15"
              >
                {STATUS_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => remove(t.id)}
                className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"
                aria-label="Delete ticket"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
