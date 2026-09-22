import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Plus } from "lucide-react";

import { workRequestsApi } from "../api/workRequests";

const STATUS_STYLES = {
  new: "bg-sky-100 text-sky-800 dark:bg-sky-800/30 dark:text-sky-200",
  triaging: "bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-200",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-800/30 dark:text-emerald-200",
  rejected: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await workRequestsApi.list();
        setRequests(data);
      } catch {
        toast.error("Couldn't load requests");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> Tickets
          </Link>
          <h1 className="text-2xl font-semibold">Requests</h1>
          <p className="mt-1 text-sm opacity-60">Review incoming work and route it into a workspace.</p>
        </div>
        <Link to="/requests/new" className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary">
          <Plus className="h-4 w-4" /> Submit request
        </Link>
      </header>

      {loading ? (
        <p className="text-sm opacity-60">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm opacity-60 dark:border-white/15">
          No requests yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-black/[0.03] text-xs uppercase tracking-wide opacity-70 dark:bg-white/[0.04]">
              <tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Request</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted by</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Due date</th><th className="px-4 py-3">Created</th></tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-mono text-xs opacity-60">{request.reference}</td>
                  <td className="px-4 py-3"><Link to={`/requests/${request.id}`} className="font-medium hover:text-primary">{request.title}</Link><span className="mt-0.5 block text-xs opacity-50">{request.request_type_label}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[request.status]}`}>{request.status_label}</span></td>
                  <td className="px-4 py-3">{request.submitted_by_detail.display_name}</td>
                  <td className="px-4 py-3 capitalize">{request.priority}</td>
                  <td className="px-4 py-3">{request.requested_due_date || "—"}</td>
                  <td className="px-4 py-3">{new Date(request.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

