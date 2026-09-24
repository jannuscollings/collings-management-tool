import { useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { REQUEST_PRIORITY_OPTIONS, workRequestsApi } from "../api/workRequests";
import { workApi } from "../api/work";
import PageContainer from "../components/layout/PageContainer";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Field, Input, Select } from "../components/ui/Field";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";

const STATUS_VARIANTS = {
  new: "info",
  triaging: "warning",
  accepted: "brand",
  rejected: "danger",
};

const PRIORITY_VARIANTS = { high: "warning", medium: "neutral", low: "neutral" };

export default function RequestDetailPage() {
  const isAdmin = useSelector((state) => state.auth.user?.is_staff);
  const { requestId } = useParams();
  const [request, setRequest] = useState(null);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [triage, setTriage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [requestResponse, workspaceResponse, usersResponse] = await Promise.all([
          workRequestsApi.get(requestId),
          workApi.getWorkspace("creative-design"),
          workApi.listUsers(),
        ]);
        const data = requestResponse.data;
        setRequest(data);
        setGroups(workspaceResponse.data.groups);
        setUsers(usersResponse.data);
        setTriage({
          destination_group: String(data.destination_group || workspaceResponse.data.groups[0]?.id || ""),
          triage_priority: data.triage_priority || "",
          triage_due_date: data.triage_due_date || "",
          owner: data.owner ? String(data.owner) : "",
          reviewer: data.reviewer ? String(data.reviewer) : "",
        });
      } catch {
        toast.error("Couldn't load the request");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [requestId]);

  const updateTriage = (field) => (event) => {
    setTriage((current) => ({ ...current, [field]: event.target.value }));
  };

  const saveTriage = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await workRequestsApi.triage(requestId, {
        destination_group: Number(triage.destination_group),
        triage_priority: triage.triage_priority || null,
        triage_due_date: triage.triage_due_date || null,
        owner: triage.owner ? Number(triage.owner) : null,
        reviewer: triage.reviewer ? Number(triage.reviewer) : null,
      });
      setRequest(data);
      toast.success("Triage saved");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Couldn't save triage");
    } finally {
      setSaving(false);
    }
  };

  const accept = async () => {
    setSaving(true);
    try {
      const { data } = await workRequestsApi.accept(requestId);
      setRequest(data);
      toast.success(`${data.resulting_work_item_detail.reference} created`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Couldn't accept the request");
    } finally {
      setSaving(false);
    }
  };

  const reject = async () => {
    if (!window.confirm("Reject this request? This cannot be undone in this version.")) return;
    setSaving(true);
    try {
      const { data } = await workRequestsApi.reject(requestId);
      setRequest(data);
      toast.success("Request rejected");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Couldn't reject the request");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageContainer className="max-w-4xl text-sm text-muted">Loading request…</PageContainer>;
  if (!request || !triage) return <PageContainer className="max-w-4xl text-sm text-copy">Request unavailable.</PageContainer>;

  const terminal = request.status === "accepted" || request.status === "rejected";
  const result = request.resulting_work_item_detail;

  return (
    <PageContainer className="max-w-4xl">
      <Button asChild variant="ghost" className="mb-4 -ml-4">
        <Link to="/requests"><ArrowLeft className="h-4 w-4" /> Requests</Link>
      </Button>
      <PageHeader
        eyebrow={`Request · ${request.reference}`}
        title={request.title}
        description={`Submitted ${new Date(request.created_at).toLocaleDateString()}`}
        actions={<Badge variant={STATUS_VARIANTS[request.status]}>{request.status_label}</Badge>}
      />

      <Panel className="mb-5 p-5 sm:p-6">
        <div className="mb-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-strong dark:text-brand">Submitted request</p>
          <h2 className="mt-1 text-lg font-extrabold text-ink">Original request details</h2>
          <p className="mt-1 text-xs text-muted">These values remain unchanged during triage.</p>
        </div>
        <dl className="grid gap-x-8 gap-y-5 text-[13px] sm:grid-cols-2">
          <div><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Request type</dt><dd className="mt-1 font-semibold text-copy">{request.request_type_label}</dd></div>
          <div><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Submitted by</dt><dd className="mt-1 font-semibold text-copy">{request.submitted_by_detail.display_name}</dd></div>
          <div><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Priority</dt><dd className="mt-1"><Badge variant={PRIORITY_VARIANTS[request.priority]} className="capitalize">{request.priority}</Badge></dd></div>
          <div><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Requested due date</dt><dd className="mt-1 font-semibold text-copy">{request.requested_due_date || "No date requested"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Brief</dt><dd className="mt-1.5 whitespace-pre-wrap leading-6 text-copy">{request.brief || "No brief supplied."}</dd></div>
        </dl>
      </Panel>

      {result && (
        <Panel className="mb-5 border-positive/30 bg-emerald-50/70 p-5 dark:bg-emerald-950/20 sm:p-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-positive">Accepted</p>
          <h2 className="mt-1 text-lg font-extrabold text-ink">Resulting work item</h2>
          <p className="mt-1 text-xs text-copy">This request was accepted into {result.group_name}.</p>
          <Button asChild className="mt-4">
            <Link to={`/workspaces/${result.workspace_slug}/items/${result.id}`}>
              Open {result.reference} <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </Panel>
      )}

      {isAdmin && !terminal && (
        <Panel className="p-5 sm:p-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-strong dark:text-brand">Triage</p>
          <h2 className="mt-1 text-lg font-extrabold text-ink">Route into delivery</h2>
          <p className="mt-1 text-xs text-muted">Choose a destination and optionally adjust delivery details.</p>
          <form onSubmit={saveTriage} className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Destination" className="sm:col-span-2">
              <Select required value={triage.destination_group} onChange={updateTriage("destination_group")}>{groups.map((group) => <option key={group.id} value={group.id}>Creative &amp; Design / {group.name}</option>)}</Select>
            </Field>
            <Field label="Priority override" hint={`Submitted priority: ${request.priority}`}>
              <Select value={triage.triage_priority} onChange={updateTriage("triage_priority")}><option value="">Use submitted priority</option>{REQUEST_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
            </Field>
            <Field label="Due-date override" hint={request.requested_due_date ? `Requested date: ${request.requested_due_date}` : "No date requested"}>
              <Input type="date" value={triage.triage_due_date} onChange={updateTriage("triage_due_date")} />
            </Field>
            <Field label="Owner">
              <Select value={triage.owner} onChange={updateTriage("owner")}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</Select>
            </Field>
            <Field label="Reviewer">
              <Select value={triage.reviewer} onChange={updateTriage("reviewer")}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</Select>
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" variant="secondary" disabled={saving}>{saving ? "Saving…" : "Save triage"}</Button>
              <Button type="button" variant="dark" onClick={accept} disabled={saving || request.status !== "triaging"}>Accept request</Button>
              <Button type="button" variant="danger" onClick={reject} disabled={saving}>Reject request</Button>
            </div>
            {request.status === "new" && <p className="text-xs text-muted sm:col-span-2">Save triage before accepting the request.</p>}
          </form>
        </Panel>
      )}

      {request.status === "rejected" && <Panel className="border-critical/25 bg-red-50/60 p-5 text-sm dark:bg-red-950/20 sm:p-6"><h2 className="font-extrabold text-ink">Request rejected</h2><p className="mt-1 text-copy">This request is closed and cannot be edited or accepted.</p></Panel>}
    </PageContainer>
  );
}
