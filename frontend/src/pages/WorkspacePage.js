import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, X } from "lucide-react";

import { WORK_PRIORITY_OPTIONS, workApi } from "../api/work";

const PRIORITY_STYLES = {
  low: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  medium: "bg-amber-200 text-amber-800 dark:bg-amber-700/40 dark:text-amber-200",
  high: "bg-red-200 text-red-800 dark:bg-red-700/40 dark:text-red-200",
};

const STATUS_LABELS = {
  new: "New",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

const emptyForm = {
  group: "",
  title: "",
  brief: "",
  priority: "medium",
  owner: "",
  reviewer: "",
  due_date: "",
};

export default function WorkspacePage() {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const [workspaceResponse, usersResponse] = await Promise.all([
        workApi.getWorkspace(workspaceSlug),
        workApi.listUsers(),
      ]);
      setWorkspace(workspaceResponse.data);
      setUsers(usersResponse.data);
      setForm((current) => ({
        ...current,
        group: current.group || String(workspaceResponse.data.groups[0]?.id || ""),
      }));
    } catch {
      toast.error("Couldn't load the workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Reload when navigating between workspace slugs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug]);

  const updateForm = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const createItem = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.group) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        group: Number(form.group),
        title: form.title.trim(),
        owner: form.owner ? Number(form.owner) : null,
        reviewer: form.reviewer ? Number(form.reviewer) : null,
        due_date: form.due_date || null,
      };
      const { data } = await workApi.createItem(payload);
      toast.success(`${data.reference} created`);
      setShowCreate(false);
      setForm({ ...emptyForm, group: form.group });
      await load();
      navigate(`/workspaces/${workspaceSlug}/items/${data.id}`);
    } catch (error) {
      const message = error.response?.data?.title?.[0] || "Couldn't create the work item";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grid h-full place-items-center text-sm opacity-70">Loading…</div>;
  if (!workspace) return <div className="p-8 text-sm">Workspace unavailable.</div>;

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> Tickets
          </Link>
          <h1 className="text-2xl font-semibold">{workspace.name}</h1>
          <p className="mt-1 text-sm opacity-60">Internal work items grouped by delivery stream.</p>
        </div>
        <button
          onClick={() => setShowCreate((visible) => !visible)}
          className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary"
        >
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? "Cancel" : "New work item"}
        </button>
      </header>

      {showCreate && (
        <form onSubmit={createItem} className="mb-8 grid gap-4 rounded-xl border border-black/10 p-5 dark:border-white/10 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Title</span>
            <input required value={form.title} onChange={updateForm("title")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-white/15" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Group</span>
            <select required value={form.group} onChange={updateForm("group")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">
              {workspace.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Brief</span>
            <textarea rows="3" value={form.brief} onChange={updateForm("brief")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-white/15" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Owner</span>
            <select value={form.owner} onChange={updateForm("owner")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">
              <option value="">Unassigned</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Reviewer</span>
            <select value={form.reviewer} onChange={updateForm("reviewer")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">
              <option value="">Unassigned</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Due date</span>
            <input type="date" value={form.due_date} onChange={updateForm("due_date")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Priority</span>
            <select value={form.priority} onChange={updateForm("priority")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">
              {WORK_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary disabled:opacity-50">
              {saving ? "Creating…" : "Create work item"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {workspace.groups.map((group) => (
          <section key={group.id}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-semibold">{group.name}</h2>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{group.work_items.length}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-black/[0.03] text-xs uppercase tracking-wide opacity-70 dark:bg-white/[0.04]">
                  <tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Due date</th><th className="px-4 py-3">Priority</th></tr>
                </thead>
                <tbody className="divide-y divide-black/10 dark:divide-white/10">
                  {group.work_items.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-6 text-center opacity-50">No work items in this group.</td></tr>
                  ) : group.work_items.map((item) => (
                    <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono text-xs opacity-60">{item.reference}</td>
                      <td className="px-4 py-3"><Link to={`/workspaces/${workspaceSlug}/items/${item.id}`} className="font-medium hover:text-primary">{item.title}</Link></td>
                      <td className="px-4 py-3">{STATUS_LABELS[item.status]}</td>
                      <td className="px-4 py-3">{item.owner_detail?.display_name || "Unassigned"}</td>
                      <td className="px-4 py-3">{item.due_date || "—"}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[item.priority]}`}>{item.priority}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

