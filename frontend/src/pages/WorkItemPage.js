import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

import { WORK_PRIORITY_OPTIONS, WORK_STATUS_OPTIONS, workApi } from "../api/work";

export default function WorkItemPage() {
  const { workspaceSlug, itemId } = useParams();
  const [item, setItem] = useState(null);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [itemResponse, workspaceResponse, usersResponse] = await Promise.all([
          workApi.getItem(itemId),
          workApi.getWorkspace(workspaceSlug),
          workApi.listUsers(),
        ]);
        const data = itemResponse.data;
        if (data.workspace_slug !== workspaceSlug) throw new Error("Workspace mismatch");
        setItem(data);
        setGroups(workspaceResponse.data.groups);
        setUsers(usersResponse.data);
        setForm({
          group: String(data.group),
          title: data.title,
          brief: data.brief,
          status: data.status,
          priority: data.priority,
          owner: data.owner ? String(data.owner) : "",
          reviewer: data.reviewer ? String(data.reviewer) : "",
          due_date: data.due_date || "",
        });
      } catch {
        toast.error("Couldn't load the work item");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [itemId, workspaceSlug]);

  const updateForm = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const save = async (event) => {
    event.preventDefault();
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
      const { data } = await workApi.updateItem(itemId, payload);
      setItem(data);
      toast.success("Work item saved");
    } catch (error) {
      const message = error.response?.data?.title?.[0] || "Couldn't save the work item";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grid h-full place-items-center text-sm opacity-70">Loading…</div>;
  if (!item || !form) return <div className="p-8 text-sm">Work item unavailable.</div>;

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8">
      <Link to={`/workspaces/${workspaceSlug}`} className="mb-5 inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100">
        <ArrowLeft className="h-4 w-4" /> {item.group_name}
      </Link>
      <header className="mb-7">
        <p className="font-mono text-xs opacity-60">{item.reference}</p>
        <h1 className="mt-1 text-2xl font-semibold">{item.title}</h1>
      </header>

      <form onSubmit={save} className="grid gap-5 rounded-xl border border-black/10 p-5 dark:border-white/10 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Title</span><input required value={form.title} onChange={updateForm("title")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-white/15" /></label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Brief</span><textarea rows="5" value={form.brief} onChange={updateForm("brief")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-white/15" /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Group</span><select value={form.group} onChange={updateForm("group")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Status</span><select value={form.status} onChange={updateForm("status")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">{WORK_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Owner</span><select value={form.owner} onChange={updateForm("owner")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Reviewer</span><select value={form.reviewer} onChange={updateForm("reviewer")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Due date</span><input type="date" value={form.due_date} onChange={updateForm("due_date")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15" /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Priority</span><select value={form.priority} onChange={updateForm("priority")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">{WORK_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="sm:col-span-2"><button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button></div>
      </form>
    </div>
  );
}

