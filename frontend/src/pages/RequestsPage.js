import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";

import { workRequestsApi } from "../api/workRequests";
import PageContainer from "../components/layout/PageContainer";
import { DrawerLink, RequestLink, useWorkItemContext } from "../components/work/WorkItemDrawer";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";

const STATUS_VARIANTS = {
  new: "info",
  triaging: "warning",
  accepted: "brand",
  rejected: "danger",
};

const PRIORITY_VARIANTS = { high: "warning", medium: "neutral", low: "neutral" };

export default function RequestsPage() {
  const { requestRevision } = useWorkItemContext();
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
  }, [requestRevision]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Manage"
        title="Requests"
        description="Review incoming work and route it into a workspace."
        actions={
          <Button asChild>
            <DrawerLink drawer="new-request"><Plus className="h-4 w-4" /> Request internal</DrawerLink>
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted">Loading requests…</p>
      ) : requests.length === 0 ? (
        <Panel className="border-dashed p-8 text-center text-sm text-muted shadow-none">No requests yet.</Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-canvas/70">
                <tr className="border-b border-line">
                  {["Reference", "Request", "Status", "Submitted by", "Priority", "Due date", "Created"].map((heading) => (
                    <th key={heading} className="px-[13px] py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-muted">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {requests.map((request) => (
                  <tr key={request.id} className="text-[11.5px] text-copy transition-colors hover:bg-brand-soft/35">
                    <td className="px-[13px] py-3 font-mono text-[10.5px] font-semibold text-muted"><RequestLink request={request} className="hover:text-brand-strong">{request.reference}</RequestLink></td>
                    <td className="px-[13px] py-3">
                      <RequestLink request={request} className="font-bold text-ink hover:text-brand-strong">{request.title}</RequestLink>
                      <span className="mt-0.5 block text-[10px] text-muted">{request.request_type_label}</span>
                    </td>
                    <td className="px-[13px] py-3"><Badge variant={STATUS_VARIANTS[request.status]}>{request.status_label}</Badge></td>
                    <td className="px-[13px] py-3">{request.submitted_by_detail.display_name}</td>
                    <td className="px-[13px] py-3"><Badge variant={PRIORITY_VARIANTS[request.priority]} className="capitalize">{request.priority}</Badge></td>
                    <td className="px-[13px] py-3">{request.requested_due_date || "—"}</td>
                    <td className="px-[13px] py-3">{new Date(request.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </PageContainer>
  );
}
