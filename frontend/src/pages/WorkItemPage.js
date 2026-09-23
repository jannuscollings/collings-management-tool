import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

import { WORK_PRIORITY_OPTIONS, WORK_STATUS_OPTIONS, workApi } from "../api/work";
import PageContainer from "../components/layout/PageContainer";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";

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

const PRIORITY_VARIANTS = {
  low: "neutral",
  medium: "neutral",
  high: "warning",
};

export default function WorkItemPage() {
  const { workspaceSlug, itemId } = useParams();
  const [item, setItem] = useState(null);
  const [workspace, setWorkspace] = useState(null);
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
        setWorkspace(workspaceResponse.data);
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

  if (loading) return <PageContainer className="max-w-4xl text-sm text-muted">Loading work item…</PageContainer>;
  if (!item || !workspace || !form) return <PageContainer className="max-w-4xl text-sm text-copy">Work item unavailable.</PageContainer>;

  return (
    <PageContainer className="max-w-4xl">
      <Button asChild variant="ghost" className="mb-4 -ml-4">
        <Link to={`/workspaces/${workspaceSlug}`}>
          <ArrowLeft className="h-4 w-4" /> {workspace.name}
        </Link>
      </Button>
      <PageHeader
        eyebrow={`Work item · ${item.reference}`}
        title={item.title}
        description={`${item.group_name} · ${workspace.name}`}
        actions={
          <>
            <Badge variant={STATUS_VARIANTS[item.status]}>{STATUS_LABELS[item.status]}</Badge>
            <Badge variant={PRIORITY_VARIANTS[item.priority]} className="capitalize">{item.priority} priority</Badge>
          </>
        }
      />

      <Panel className="p-5 sm:p-6">
        <div className="mb-5 border-b border-line pb-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-strong dark:text-brand">Core details</p>
          <h2 className="mt-1 text-lg font-extrabold text-ink">Work item properties</h2>
          <p className="mt-1 text-xs text-muted">Update the delivery details below and save when finished.</p>
        </div>
        <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <Input required value={form.title} onChange={updateForm("title")} />
          </Field>
          <Field label="Group">
            <Select value={form.group} onChange={updateForm("group")}>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={updateForm("status")}>
              {WORK_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={updateForm("priority")}>
              {WORK_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date} onChange={updateForm("due_date")} />
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
          <Field label="Brief" className="sm:col-span-2">
            <Textarea rows="5" value={form.brief} onChange={updateForm("brief")} />
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Panel>
    </PageContainer>
  );
}
