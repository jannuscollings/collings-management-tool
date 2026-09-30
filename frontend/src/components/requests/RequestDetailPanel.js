import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ExternalLink } from "lucide-react";

import { REQUEST_PRIORITY_OPTIONS, workRequestsApi } from "../../api/workRequests";
import { workApi } from "../../api/work";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";
import PageHeader from "../ui/PageHeader";
import Panel from "../ui/Panel";

const STATUS_VARIANTS = { new: "info", triaging: "warning", accepted: "brand", rejected: "danger" };
const PRIORITY_VARIANTS = { high: "warning", medium: "neutral", low: "neutral" };
const noop = () => {};
const TRIAGE_FIELDS = ["destination_group", "triage_priority", "triage_due_date", "owner", "reviewer"];
const savedTriage = (request) => Object.fromEntries(
  TRIAGE_FIELDS.map((field) => [field, String(request[field] ?? "")]),
);
const triageDiffers = (triage, request) => TRIAGE_FIELDS.some(
  (field) => triage[field] !== String(request[field] ?? ""),
);

export default function RequestDetailPanel({ requestId, drawer = false, onChanged = noop, onDirty = noop, onBusy = noop }) {
  const isAdmin = useSelector((state) => state.auth.user?.is_staff);
  const [request, setRequest] = useState(null);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [triage, setTriage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([workRequestsApi.get(requestId), workApi.listWorkspaces(), workApi.listUsers()])
      .then(async ([requestResponse, workspacesResponse, usersResponse]) => {
        if (!active) return;
        const data = requestResponse.data;
        const destinations = isAdmin && data.status !== "accepted" && data.status !== "rejected"
          ? (await Promise.all(workspacesResponse.data.map((workspace) => workApi.getWorkspace(workspace.slug))))
            .flatMap(({ data: workspace }) => workspace.groups.map((group) => ({ ...group, workspace_name: workspace.name })))
          : [];
        if (!active) return;
        setRequest(data);
        setGroups(destinations);
        setUsers(usersResponse.data);
        setTriage({ ...savedTriage(data), destination_group: String(data.destination_group || destinations[0]?.id || "") });
        onDirty(false);
      })
      .catch(() => toast.error("Couldn't load the request"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestId, onDirty, isAdmin]);

  useEffect(() => { onBusy(saving); }, [saving, onBusy]);

  const updateTriage = (field) => (event) => {
    const next = { ...triage, [field]: event.target.value };
    setTriage(next);
    onDirty(triageDiffers(next, request));
  };

  const hasUnsavedTriage = Boolean(request && triage && triageDiffers(triage, request));

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
      setTriage(savedTriage(data));
      onDirty(false);
      onChanged();
      toast.success("Triage saved");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Couldn't save triage");
    } finally { setSaving(false); }
  };

  const accept = async () => {
    if (saving || request.status !== "triaging" || hasUnsavedTriage) return;
    setSaving(true);
    try {
      const { data } = await workRequestsApi.accept(requestId);
      setRequest(data);
      onDirty(false);
      onChanged();
      toast.success(`${data.resulting_work_item_detail.reference} created`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Couldn't accept the request");
    } finally { setSaving(false); }
  };

  const reject = async () => {
    const reason = rejectionReason.trim();
    if (!reason || saving) return;
    if (!window.confirm("Reject this request? This cannot be undone in this version.")) return;
    setSaving(true);
    try {
      const { data } = await workRequestsApi.reject(requestId, { rejection_reason: reason });
      setRequest(data);
      onDirty(false);
      onChanged();
      toast.success("Request rejected");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Couldn't reject the request");
    } finally { setSaving(false); }
  };

  if (loading) return <p role="status" className="text-sm text-muted">Loading request…</p>;
  if (!request || !triage) return <p className="text-sm text-copy">Request unavailable.</p>;

  const terminal = request.status === "accepted" || request.status === "rejected";
  const result = request.resulting_work_item_detail;

  return <div className="min-w-0 space-y-5 pb-16 shell:pb-0">
    {drawer && <div className="flex justify-end"><Link to={`/requests/${request.id}`} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-brand-strong shell:min-h-0">Full page <ExternalLink className="h-3.5 w-3.5" /></Link></div>}
    <div className="min-w-0 break-all shell:break-words"><PageHeader eyebrow={`Request · ${request.reference}`} title={request.title} description={`Submitted ${new Date(request.created_at).toLocaleDateString()}`} actions={<Badge variant={STATUS_VARIANTS[request.status]}>{request.status_label}</Badge>} /></div>

    <Panel className="p-5 sm:p-6">
      <div className="mb-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-strong dark:text-brand">Submitted request</p><h2 className="mt-1 text-lg font-extrabold text-ink">Original request details</h2><p className="mt-1 text-xs text-muted">These values remain unchanged during triage.</p></div>
      <dl className="grid gap-x-8 gap-y-5 text-[13px] sm:grid-cols-2">
        <div className="min-w-0 break-all shell:break-words"><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Request type</dt><dd className="mt-1 font-semibold text-copy">{request.request_type_label}</dd></div>
        <div className="min-w-0 break-all shell:break-words"><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Submitted by</dt><dd className="mt-1 font-semibold text-copy">{request.submitted_by_detail.display_name}</dd></div>
        <div><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Priority</dt><dd className="mt-1"><Badge variant={PRIORITY_VARIANTS[request.priority]} className="capitalize">{request.priority}</Badge></dd></div>
        <div><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Requested due date</dt><dd className="mt-1 font-semibold text-copy">{request.requested_due_date || "No date requested"}</dd></div>
        <div className="min-w-0 sm:col-span-2"><dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Brief</dt><dd className="mt-1.5 whitespace-pre-wrap break-all leading-6 text-copy shell:break-words">{request.brief || "No brief supplied."}</dd></div>
      </dl>
    </Panel>

    {result && <Panel className="border-positive/30 bg-emerald-50/70 p-5 dark:bg-emerald-950/20 sm:p-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-positive">Accepted</p><h2 className="mt-1 text-lg font-extrabold text-ink">Resulting work item</h2>
      <p className="mt-1 break-all text-sm font-bold text-ink shell:break-words">{result.reference}</p>
      <p className="mt-1 break-all text-xs text-copy shell:break-words">Destination: {[result.workspace_name, result.group_name].filter(Boolean).join(" / ") || "Not available"}</p>
      {request.can_view_resulting_work_item
        ? <Button asChild className="mt-4 min-h-11 shell:min-h-[38px]"><Link to={`/workspaces/${result.workspace_slug}/items/${result.id}`}>Open {result.reference} <ExternalLink className="h-4 w-4" /></Link></Button>
        : <p className="mt-3 text-xs text-copy">This work item is available to its assigned delivery team.</p>}
    </Panel>}

    {isAdmin && !terminal && <Panel className="p-5 sm:p-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-strong dark:text-brand">Triage</p><h2 className="mt-1 text-lg font-extrabold text-ink">Route into delivery</h2><p className="mt-1 text-xs text-muted">Choose a destination and optionally adjust delivery details.</p>
      <form onSubmit={saveTriage} className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Destination" className="sm:col-span-2"><Select required value={triage.destination_group} onChange={updateTriage("destination_group")}><option value="" disabled>Choose a board</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.workspace_name} / {group.name}</option>)}</Select></Field>
        <Field label="Priority override" hint={`Submitted priority: ${request.priority}`}><Select value={triage.triage_priority} onChange={updateTriage("triage_priority")}><option value="">Use submitted priority</option>{REQUEST_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        <Field label="Due-date override" hint={request.requested_due_date ? `Requested date: ${request.requested_due_date}` : "No date requested"}><Input type="date" value={triage.triage_due_date} onChange={updateTriage("triage_due_date")} /></Field>
        <Field label="Owner"><Select value={triage.owner} onChange={updateTriage("owner")}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</Select></Field>
        <Field label="Reviewer"><Select value={triage.reviewer} onChange={updateTriage("reviewer")}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</Select></Field>
        <Field label="Rejection reason" hint="Required only when rejecting. Keep it brief (300 characters maximum)." className="sm:col-span-2"><Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={300} rows={2} /></Field>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" variant="secondary" disabled={saving} className="min-h-11 shell:min-h-[38px]">{saving ? "Saving…" : "Save triage"}</Button><Button type="button" variant="dark" onClick={accept} disabled={saving || request.status !== "triaging" || hasUnsavedTriage} className="min-h-11 shell:min-h-[38px]">Accept request</Button><Button type="button" variant="danger" onClick={reject} disabled={saving || !rejectionReason.trim()} className="min-h-11 shell:min-h-[38px]">Reject request</Button></div>
        {request.status === "new" && <p className="text-xs text-muted sm:col-span-2">Save triage before accepting the request.</p>}
        {request.status === "triaging" && hasUnsavedTriage && <p role="status" className="text-xs text-muted sm:col-span-2">Save triage before accepting the request.</p>}
      </form>
    </Panel>}
    {request.status === "rejected" && <Panel className="border-critical/25 bg-red-50/60 p-5 text-sm dark:bg-red-950/20 sm:p-6"><h2 className="font-extrabold text-ink">Request rejected</h2><p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">Reason</p><p className="mt-1 whitespace-pre-wrap break-words text-copy">{request.rejection_reason || "No reason recorded."}</p><p className="mt-3 text-xs text-muted">This request is closed and cannot be edited or accepted.</p></Panel>}
  </div>;
}
