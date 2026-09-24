import { useEffect, useState } from "react";
import { awarenessApi } from "../api/awareness";
import { DrawerLink, RequestLink, WorkItemLink, useWorkItemContext } from "../components/work/WorkItemDrawer";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

const sections = [
  ['my_open', 'My open work', 'neutral'], ['due_soon', 'Due soon · today + 3 days', 'warning'],
  ['overdue', 'Overdue', 'danger'], ['review', 'Awaiting my review', 'review'],
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
  return <PageContainer>
    <PageHeader eyebrow="Overview" title="Home" description="What needs your attention right now" />
    <div className="mb-5 flex items-center justify-between gap-3 text-xs text-muted">
      <p>Your ownership, review and assigned sub-work across active workspaces.</p>
      <DrawerLink drawer="new-request" className="shrink-0 font-bold text-brand-strong">+ New request</DrawerLink>
    </div>
    {error ? <Panel className="p-5"><p role="alert">Couldn't load your work.</p><Button onClick={() => setRetry(x => x+1)}>Retry</Button></Panel>
      : !data ? <p role="status" className="text-sm text-muted">Loading your work…</p>
      : <div className="grid gap-4 lg:grid-cols-2">{sections.filter(([key]) => data[key]).map(([key, title, variant]) =>
        <Panel key={key} className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3"><h2 className="text-sm font-bold">{title}</h2><Badge variant={variant}>{data[key].count}</Badge></div>
          <ul className="divide-y divide-line px-4">{data[key].items.length ? data[key].items.map(item => {
            const TargetLink = key === 'triage' ? RequestLink : WorkItemLink;
            return <li key={item.id} className="py-3 text-xs">
              <TargetLink {...(key === 'triage' ? { request: item } : { item })} className="font-bold text-ink hover:text-brand-strong">{item.reference} · {item.title}</TargetLink>
              {key !== 'triage' && <div className="mt-1 flex flex-wrap items-center gap-2 text-muted">
                <span>{item.group__workspace__name}</span><span>{item.priority} priority</span>
                <span>{item.due_date ? `Due ${item.due_date}` : 'No due date'}</span>
                {item.status === 'review' && <Badge variant="review">Awaiting review</Badge>}
                {item.status !== 'done' && item.due_date && item.due_date < data.today && <Badge variant="danger">Overdue</Badge>}
              </div>}
            </li>;
          }) : <li className="py-5 text-xs text-muted">Nothing needs attention here.</li>}</ul>
          {data[key].count > 12 && <p className="px-4 pb-3 text-xs text-muted">Showing 12 of {data[key].count}. See {key === 'triage' ? 'Requests' : 'My Work or your workspace'} for the full list.</p>}
        </Panel>
      )}</div>}
  </PageContainer>;
}
