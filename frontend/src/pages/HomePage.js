import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { awarenessApi } from "../api/awareness";
import { DrawerLink, RequestLink, WorkItemLink, useWorkItemContext } from "../components/work/WorkItemDrawer";
import PageContainer from "../components/layout/PageContainer";
import Panel from "../components/ui/Panel";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import DueDate from "../components/work/DueDate";
import AskDoma from "../components/home/AskDoma";

const GROUPS = [
  ["overdue", "Overdue", "danger"],
  ["due_today", "Due today", "warning"],
  ["due_soon", "Due soon", "warning"],
  ["review", "Waiting for your review", "review"],
  ["changes_requested", "Changes requested", "warning"],
  ["my_open", "My open work", "neutral"],
];
const STATUS = { new: ["New", "neutral"], in_progress: ["In progress", "info"], review: ["Review", "review"], done: ["Done", "success"] };

export function homeAttentionRows(data) {
  const rows = new Map();
  GROUPS.forEach(([key, label, variant]) => {
    (data[key]?.items || []).forEach((item) => {
      if (!rows.has(item.id)) rows.set(item.id, { item, reasons: [] });
      const row = rows.get(item.id);
      if (key === "my_open") {
        if (!row.reasons.length) row.reasons.push({ label, variant });
      } else {
        row.reasons = row.reasons.filter((reason) => reason.label !== "My open work");
        row.reasons.push({ label, variant });
      }
    });
  });
  return [...rows.values()];
}

function WorkRows({ rows, today, empty }) {
  if (!rows.length) return <p className="px-4 py-8 text-sm text-muted">{empty}</p>;
  return <>
    <div className="hidden overflow-x-auto shell:block">
      <table className="w-full table-fixed text-left text-xs">
        <thead className="border-b border-line bg-canvas/60 text-[10px] font-extrabold uppercase tracking-wider text-muted"><tr>
          <th className="w-[30%] px-4 py-3">Work Item</th><th className="w-[18%] px-3 py-3">Workspace</th>
          <th className="w-[12%] px-3 py-3">Status</th><th className="w-[10%] px-3 py-3">Priority</th>
          <th className="w-[15%] px-3 py-3">Due</th><th className="w-[15%] px-3 py-3">Attention</th>
        </tr></thead>
        <tbody className="divide-y divide-line">{rows.map(({ item, reasons }) => <tr key={item.id} className="align-top hover:bg-canvas/50">
          <td className="px-4 py-3"><WorkItemLink item={item} className="block min-w-0 font-bold text-ink hover:text-brand-strong"><span className="block font-mono text-[10px] font-medium text-muted">{item.reference}</span><span className="break-words">{item.title}</span></WorkItemLink></td>
          <td className="break-words px-3 py-3">{item.group__workspace__name}</td>
          <td className="px-3 py-3"><Badge variant={STATUS[item.status]?.[1]}>{STATUS[item.status]?.[0] || item.status}</Badge></td>
          <td className="px-3 py-3 capitalize">{item.priority}</td>
          <td className="px-3 py-3"><DueDate item={item} today={today} empty="—" /></td>
          <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{reasons.map(({ label, variant }) => <Badge key={label} variant={variant}>{label}</Badge>)}</div></td>
        </tr>)}</tbody>
      </table>
    </div>
    <ul className="divide-y divide-line shell:hidden">{rows.map(({ item, reasons }) => <li key={item.id} className="min-w-0 px-4 py-4 text-xs">
      <WorkItemLink item={item} className="block min-h-11 min-w-0 font-bold text-ink hover:text-brand-strong"><span className="block font-mono text-[10px] font-medium text-muted">{item.reference}</span><span className="block break-all text-sm">{item.title}</span></WorkItemLink>
      <p className="mt-1 min-w-0 break-all text-muted">{item.group__workspace__name} · <DueDate item={item} today={today} empty="No due date" /></p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5"><Badge variant={STATUS[item.status]?.[1]}>{STATUS[item.status]?.[0] || item.status}</Badge><span className="capitalize text-muted">{item.priority} priority</span>{reasons.map(({ label, variant }) => <Badge key={label} variant={variant}>{label}</Badge>)}</div>
    </li>)}</ul>
  </>;
}

export default function HomePage() {
  const user = useSelector((state) => state.auth.user);
  const { revision, requestRevision, workspaceRevision, workspaces } = useWorkItemContext();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestedView = params.get("view");
  const view = ["review", "recent"].includes(requestedView) || (requestedView === "requests" && user?.is_staff) ? requestedView : "attention";
  useEffect(() => {
    let active = true;
    setError(false); setData(null);
    awarenessApi.home().then(({ data }) => { if (active) setData(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [revision, requestRevision, workspaceRevision, retry]);
  const setView = (nextView) => {
    const next = new URLSearchParams(params);
    if (nextView === "attention") next.delete("view"); else next.set("view", nextView);
    setParams(next);
  };
  const views = [["attention", "My Attention"], ["review", "My Reviews"], ["recent", "Recent"]];
  if (user?.is_staff && data?.triage) views.push(["requests", "Requests"]);
  const rows = view === "review" ? (data?.review?.items || []).map((item) => ({ item, reasons: [{ label: "Waiting for your review", variant: "review" }] }))
    : view === "recent" ? (data?.recent?.items || []).map((item) => ({ item, reasons: [{ label: "Recently updated", variant: "neutral" }] }))
    : data ? homeAttentionRows(data) : [];
  const firstName = user?.first_name?.trim();

  return <PageContainer className="pb-32 shell:pb-28">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-muted">Overview</p><h1 className="text-2xl font-extrabold text-ink">Hi{firstName ? `, ${firstName}` : ""}</h1><p className="mt-1 text-sm text-muted">Here’s what needs your attention.</p></div>
      <DrawerLink drawer="new-request" className="inline-flex min-h-11 items-center text-xs font-bold text-brand-strong shell:min-h-0">+ New request</DrawerLink>
    </div>
    {error ? <Panel className="p-5"><p role="alert">Couldn't load your work.</p><Button onClick={() => setRetry((x) => x + 1)}>Retry</Button></Panel>
      : !data ? <p role="status" className="text-sm text-muted">Loading your work…</p>
      : <>
        <div className="mb-4 flex flex-wrap gap-2 text-xs" aria-label="Attention summary">
          {GROUPS.filter(([key]) => key !== "my_open" && data[key]?.count).map(([key, label, variant]) => <Badge key={key} variant={variant}>{data[key].count} {label}</Badge>)}
          {!GROUPS.some(([key]) => key !== "my_open" && data[key]?.count) && <span className="text-muted">No urgent attention items right now.</span>}
        </div>
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Home views">{views.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`min-h-11 rounded-ds-xs px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand shell:min-h-9 ${view === key ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-canvas"}`}>{label}{key === "requests" && data.triage?.count ? ` (${data.triage.count})` : ""}</button>)}</div>
            <Link to={view === "requests" ? "/requests" : "/my-work"} className="text-xs font-bold text-brand-strong hover:underline">View {view === "requests" ? "all Requests" : "My Work"}</Link>
          </div>
          {view === "requests" && user?.is_staff && data.triage ? <ul className="divide-y divide-line">{data.triage.items.length ? data.triage.items.map((request) => <li key={request.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><RequestLink request={request} className="min-w-0 break-all font-bold text-ink hover:text-brand-strong"><span className="mr-2 font-mono text-[10px] font-medium text-muted">{request.reference}</span>{request.title}</RequestLink><Badge variant={request.status === "triaging" ? "warning" : "info"}>{request.status === "triaging" ? "Triaging" : "New"}</Badge></li>) : <li className="px-4 py-8 text-sm text-muted">No requests need triage.</li>}</ul>
            : <WorkRows rows={rows} today={data.today} empty={view === "review" ? "Nothing is waiting for your review." : view === "recent" ? "No recently updated work." : "Nothing needs your attention right now."} />}
          {view === "attention" && <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-xs font-bold text-brand-strong">{[["overdue", "overdue"], ["due_today", "today"], ["due_soon", "soon"]].filter(([key]) => data[key]?.count).map(([key, due]) => <Link key={key} to={`/my-work?due=${due}`} className="hover:underline">View all {key === "due_today" ? "due today" : key === "due_soon" ? "due soon" : "overdue"} in My Work</Link>)}</div>}
          {view === "requests" && data.triage?.count > data.triage.items.length && <p className="px-4 pb-3 text-xs text-muted">Showing {data.triage.items.length} of {data.triage.count}. See Requests for the full list.</p>}
        </Panel>
      </>}
    <AskDoma isAdmin={Boolean(user?.is_staff)} workspaces={workspaces} />
  </PageContainer>;
}
