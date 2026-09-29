import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { awarenessApi } from "../api/awareness";
import { DrawerLink, RequestLink, WorkItemLink, useWorkItemContext } from "../components/work/WorkItemDrawer";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import DueDate from "../components/work/DueDate";

const sections = [
  ['overdue', 'Overdue', 'danger', 'overdue'], ['due_today', 'Due today', 'warning', 'today'],
  ['due_soon', 'Due soon · next 3 days', 'warning', 'soon'], ['review', 'Awaiting my review', 'review'],
  ['my_open', 'My open work', 'neutral'],
  ['recent', 'Recently updated · last 7 days', 'neutral'], ['triage', 'New requests requiring triage', 'brand'],
];
export default function HomePage() {
  const { revision, requestRevision, workspaceRevision } = useWorkItemContext();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false); setData(null);
    awarenessApi.home().then(({ data }) => { if (active) setData(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [revision, requestRevision, workspaceRevision, retry]);
  return <PageContainer className="pb-16 shell:pb-[34px]">
    <PageHeader eyebrow="Overview" title="Home" description="What needs your attention right now" />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
      <p className="min-w-0 break-words">Your ownership, review and assigned sub-work across active workspaces.</p>
      <DrawerLink drawer="new-request" className="inline-flex min-h-11 items-center font-bold text-brand-strong shell:min-h-0">+ New request</DrawerLink>
    </div>
    {error ? <Panel className="p-5"><p role="alert">Couldn't load your work.</p><Button onClick={() => setRetry(x => x+1)}>Retry</Button></Panel>
      : !data ? <p role="status" className="text-sm text-muted">Loading your work…</p>
      : <div className="grid gap-4 lg:grid-cols-2">{sections.filter(([key]) => data[key]).map(([key, title, variant, due]) =>
        <Panel key={key} className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3"><h2 className="min-w-0 break-words text-sm font-bold">{title}</h2><Badge variant={variant}>{data[key].count}</Badge></div>
          <ul className="divide-y divide-line px-4">{data[key].items.length ? data[key].items.map(item => {
            const TargetLink = key === 'triage' ? RequestLink : WorkItemLink;
            return <li key={item.id} className="min-w-0 py-3 text-xs">
              <TargetLink {...(key === 'triage' ? { request: item } : { item })} className="block min-h-11 min-w-0 font-bold text-ink hover:text-brand-strong shell:min-h-0">
                <span className="block font-mono text-[10px] text-muted shell:inline shell:font-sans shell:text-xs shell:text-ink">{item.reference}</span><span className="hidden shell:inline"> · </span><span className="block break-all shell:inline shell:break-words">{item.title}</span>
              </TargetLink>
              {key !== 'triage' && <div className="mt-1 flex flex-wrap items-center gap-2 break-words text-muted">
                <span className="min-w-0 break-all shell:break-words">{item.group__workspace__name}</span><span>{item.priority} priority</span>
                <DueDate item={item} today={data.today} prefix="Due " empty="No due date" />
                {item.status === 'review' && <Badge variant="review">Awaiting review</Badge>}
              </div>}
            </li>;
          }) : <li className="py-5 text-xs text-muted">Nothing needs attention here.</li>}</ul>
          {due && <div className="px-4 pb-3"><Link to={`/my-work?due=${due}`} className="text-xs font-bold text-brand-strong hover:underline">View all {title.split(' · ')[0].toLowerCase()} in My Work</Link></div>}
          {data[key].count > 12 && !due && <p className="px-4 pb-3 text-xs text-muted">Showing 12 of {data[key].count}. See {key === 'triage' ? 'Requests' : 'My Work or your workspace'} for the full list.</p>}
        </Panel>
      )}</div>}
  </PageContainer>;
}
