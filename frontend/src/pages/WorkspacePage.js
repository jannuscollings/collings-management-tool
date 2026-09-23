import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";

import { WORK_PRIORITY_OPTIONS, workApi } from "../api/work";
import PageContainer from "../components/layout/PageContainer";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";

const PRIORITY_VARIANTS = {
  low: "neutral",
  medium: "neutral",
  high: "warning",
};

const STATUS_LABELS = {
  new: "New",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

const STATUS_VARIANTS = {
  new: "neutral",
  in_progress: "info",
  review: "review",
  done: "success",
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

  if (loading) return <PageContainer className="text-sm text-muted">Loading workspace…</PageContainer>;
  if (!workspace) return <PageContainer className="text-sm text-copy">Workspace unavailable.</PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Workspace"
        title={workspace.name}
        description="Internal work items grouped by delivery stream."
        actions={
          <Button
            variant={showCreate ? "secondary" : "primary"}
            onClick={() => setShowCreate((visible) => !visible)}
          >
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? "Cancel" : "New work item"}
          </Button>
        }
      />

      {showCreate && (
        <Panel className="mb-7 p-5 sm:p-6">
          <form onSubmit={createItem} className="grid gap-5 sm:grid-cols-2">
          <Field label="Title">
            <Input required value={form.title} onChange={updateForm("title")} />
          </Field>
          <Field label="Group">
            <Select required value={form.group} onChange={updateForm("group")}>
              {workspace.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </Select>
          </Field>
          <Field label="Brief" className="sm:col-span-2">
            <Textarea rows="3" value={form.brief} onChange={updateForm("brief")} />
          </Field>
          <Field label="Owner">
            <Select value={form.owner} onChange={updateForm("owner")}>
              <option value="">Unassigned</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
            </Select>
          </Field>
          <Field label="Reviewer">
            <Select value={form.reviewer} onChange={updateForm("reviewer")}>
              <option value="">Unassigned</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date} onChange={updateForm("due_date")} />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={updateForm("priority")}>
              {WORK_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create work item"}
            </Button>
          </div>
          </form>
        </Panel>
      )}

      <div className="space-y-5">
        {workspace.groups.map((group) => (
          <section key={group.id}>
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/55 px-4 py-3">
                <h2 className="text-[13px] font-extrabold tracking-[0.02em] text-ink">{group.name}</h2>
                <Badge variant="neutral">{group.work_items.length} {group.work_items.length === 1 ? "item" : "items"}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="bg-canvas/35">
                    <tr className="border-b border-line">
                      {["Reference", "Work item", "Status", "Priority", "Owner", "Reviewer", "Due date"].map((heading) => (
                        <th key={heading} className="px-[13px] py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-muted">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {group.work_items.length === 0 ? (
                      <tr><td colSpan="7" className="px-4 py-6 text-center text-xs text-muted">No work items in this group.</td></tr>
                    ) : group.work_items.map((item) => (
                      <tr key={item.id} className="text-[11.5px] text-copy transition-colors hover:bg-brand-soft/35">
                        <td className="px-[13px] py-3 font-mono text-[10.5px] font-semibold text-muted">
                          <Link to={`/workspaces/${workspaceSlug}/items/${item.id}`} className="hover:text-brand-strong">{item.reference}</Link>
                        </td>
                        <td className="px-[13px] py-3">
                          <Link to={`/workspaces/${workspaceSlug}/items/${item.id}`} className="font-bold text-ink hover:text-brand-strong">{item.title}</Link>
                        </td>
                        <td className="px-[13px] py-3"><Badge variant={STATUS_VARIANTS[item.status]}>{STATUS_LABELS[item.status]}</Badge></td>
                        <td className="px-[13px] py-3"><Badge variant={PRIORITY_VARIANTS[item.priority]} className="capitalize">{item.priority}</Badge></td>
                        <td className="px-[13px] py-3">{item.owner_detail?.display_name || "Unassigned"}</td>
                        <td className="px-[13px] py-3">{item.reviewer_detail?.display_name || "Unassigned"}</td>
                        <td className="px-[13px] py-3">{item.due_date || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
