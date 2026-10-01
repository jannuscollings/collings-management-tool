import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { WORK_PRIORITY_OPTIONS, workApi } from "../../api/work";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";

const blankForm = {
  group: "",
  title: "",
  brief: "",
  priority: "medium",
  owner: "",
  reviewer: "",
  start_date: "",
  due_date: "",
};

export default function NewWorkItemForm({ workspaceSlug, onCreated, onDirty, onBusy }) {
  const [workspace, setWorkspace] = useState(null);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify({
    ...blankForm,
    group: String(workspace?.groups[0]?.id || ""),
  }), [form, workspace]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([workApi.getWorkspace(workspaceSlug), workApi.listUsers()])
      .then(([workspaceResponse, usersResponse]) => {
        if (!active) return;
        setWorkspace(workspaceResponse.data);
        setUsers(usersResponse.data);
        setForm((current) => ({
          ...current,
          group: current.group || String(workspaceResponse.data.groups[0]?.id || ""),
        }));
      })
      .catch(() => toast.error("Couldn't prepare the work item form"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceSlug]);

  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { onBusy(saving); }, [saving, onBusy]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.group) return;
    setSaving(true);
    try {
      const { data } = await workApi.createItem({
        ...form,
        group: Number(form.group),
        title: form.title.trim(),
        owner: form.owner ? Number(form.owner) : null,
        reviewer: form.reviewer ? Number(form.reviewer) : null,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
      });
      toast.success(`${data.reference} created`);
      onDirty(false);
      onCreated(data);
    } catch (error) {
      const errors = error.response?.data;
      toast.error(errors?.start_date?.[0] || errors?.due_date?.[0] || errors?.title?.[0] || errors?.detail || "Couldn't create the work item");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted">Preparing form…</p>;
  if (!workspace) return <p className="text-sm text-copy">Workspace unavailable.</p>;
  if (workspace.groups.length === 0) return <p className="text-sm text-copy">This workspace needs an active group before work can be created.</p>;

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <Field label="Title" className="sm:col-span-2">
        <Input required autoFocus value={form.title} onChange={update("title")} />
      </Field>
      <Field label="Group">
        <Select required value={form.group} onChange={update("group")}>
          {workspace.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </Select>
      </Field>
      <Field label="Priority">
        <Select value={form.priority} onChange={update("priority")}>
          {WORK_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Field>
      <Field label="Brief" className="sm:col-span-2">
        <Textarea rows="5" value={form.brief} onChange={update("brief")} />
      </Field>
      <Field label="Owner">
        <Select value={form.owner} onChange={update("owner")}>
          <option value="">Unassigned</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
        </Select>
      </Field>
      <Field label="Reviewer">
        <Select value={form.reviewer} onChange={update("reviewer")}>
          <option value="">Unassigned</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
        </Select>
      </Field>
      <Field label="Start date">
        <Input type="date" value={form.start_date} onChange={update("start_date")} />
      </Field>
      <Field label="Due date">
        <Input type="date" value={form.due_date} onChange={update("due_date")} />
      </Field>
      <div className="flex items-end sm:col-span-2 sm:justify-end">
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Creating…" : "Create work item"}
        </Button>
      </div>
    </form>
  );
}
