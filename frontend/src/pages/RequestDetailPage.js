import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { REQUEST_PRIORITY_OPTIONS, workRequestsApi } from "../api/workRequests";
import { workApi } from "../api/work";

export default function RequestDetailPage() {
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

  if (loading) return <div className="grid h-full place-items-center text-sm opacity-70">Loading…</div>;
  if (!request || !triage) return <div className="p-8 text-sm">Request unavailable.</div>;

  const terminal = request.status === "accepted" || request.status === "rejected";
  const result = request.resulting_work_item_detail;

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8">
      <Link to="/requests" className="mb-5 inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100"><ArrowLeft className="h-4 w-4" /> Requests</Link>
      <header className="mb-7"><p className="font-mono text-xs opacity-60">{request.reference}</p><h1 className="mt-1 text-2xl font-semibold">{request.title}</h1><p className="mt-1 text-sm opacity-60">{request.status_label}</p></header>

      <section className="mb-6 rounded-xl border border-black/10 p-5 dark:border-white/10">
        <h2 className="mb-4 font-semibold">Original submitted request</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="opacity-50">Request type</dt><dd>{request.request_type_label}</dd></div>
          <div><dt className="opacity-50">Submitted by</dt><dd>{request.submitted_by_detail.display_name}</dd></div>
          <div><dt className="opacity-50">Priority</dt><dd className="capitalize">{request.priority}</dd></div>
          <div><dt className="opacity-50">Requested due date</dt><dd>{request.requested_due_date || "No date requested"}</dd></div>
          <div className="sm:col-span-2"><dt className="opacity-50">Brief</dt><dd className="mt-1 whitespace-pre-wrap">{request.brief || "No brief supplied."}</dd></div>
        </dl>
      </section>

      {result && (
        <section className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <h2 className="font-semibold">Resulting work item</h2>
          <p className="mt-1 text-sm opacity-70">This request was accepted into {result.group_name}.</p>
          <Link to={`/workspaces/${result.workspace_slug}/items/${result.id}`} className="mt-4 inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary">
            Open {result.reference} <ExternalLink className="h-4 w-4" />
          </Link>
        </section>
      )}

      {!terminal && (
        <section className="rounded-xl border border-black/10 p-5 dark:border-white/10">
          <h2 className="font-semibold">Triage</h2>
          <p className="mt-1 text-sm opacity-60">Route the request and optionally adjust delivery details.</p>
          <form onSubmit={saveTriage} className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Destination</span><select required value={triage.destination_group} onChange={updateTriage("destination_group")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">{groups.map((group) => <option key={group.id} value={group.id}>Creative &amp; Design / {group.name}</option>)}</select></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Priority override</span><select value={triage.triage_priority} onChange={updateTriage("triage_priority")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"><option value="">Use submitted priority ({request.priority})</option>{REQUEST_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Due-date override</span><input type="date" value={triage.triage_due_date} onChange={updateTriage("triage_due_date")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15" /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Owner</span><select value={triage.owner} onChange={updateTriage("owner")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Reviewer</span><select value={triage.reviewer} onChange={updateTriage("reviewer")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/15">{saving ? "Saving…" : "Save triage"}</button>
              <button type="button" onClick={accept} disabled={saving || request.status !== "triaging"} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary disabled:opacity-40">Accept request</button>
              <button type="button" onClick={reject} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-40">Reject</button>
            </div>
            {request.status === "new" && <p className="text-xs opacity-55 sm:col-span-2">Save triage before accepting the request.</p>}
          </form>
        </section>
      )}

      {request.status === "rejected" && <section className="rounded-xl border border-black/10 p-5 text-sm dark:border-white/10"><h2 className="font-semibold">Request rejected</h2><p className="mt-1 opacity-60">This request is closed and cannot be edited or accepted.</p></section>}
    </div>
  );
}

