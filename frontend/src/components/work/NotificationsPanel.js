import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { awarenessApi } from "../../api/awareness";
import { Button } from "../ui/Button";
import Badge from "../ui/Badge";

const labels = { assigned: 'Assigned to you', reviewer_assigned: 'You are the reviewer', review_ready: 'Ready for your review',
  sub_work_assigned: 'Sub-work assigned to you', mentioned: 'You were mentioned', reply: 'Reply to your discussion',
  approved: 'Review approved', changes_requested: 'Changes requested', request_accepted: 'Request accepted', request_rejected: 'Request rejected' };
export default function NotificationsPanel({ inbox, loading, error, refresh }) {
  const navigate = useNavigate(), location = useLocation();
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
  const [older, setOlder] = useState([]), [cursor, setCursor] = useState(undefined);
  useEffect(() => { setOlder([]); setCursor(undefined); }, [inbox]);
  const next = cursor === undefined ? inbox.next_before : cursor;
  const perform = async (fn) => { setBusy(true); setActionError(''); try { await fn(); } catch { setActionError('Could not update notifications. Please retry.'); } finally { setBusy(false); } };
  const open = (n) => perform(async () => {
    await awarenessApi.read(n.id);
    refresh();
    const query = new URLSearchParams(location.search);
    ['drawer', 'drawerWorkspace', 'item', 'request'].forEach(key => query.delete(key));
    query.set(n.target.kind, n.target.id);
    navigate({ pathname: location.pathname, search: query.toString() });
  });
  const mark = (n) => perform(async () => {
    await awarenessApi.read(n.id);
    setOlder(rows => rows.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
    refresh();
  });
  const rows = [...inbox.items, ...older.filter(x => !inbox.items.some(n => n.id === x.id))];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="brand">{inbox.unread_count} unread</Badge>
      <div className="flex gap-2"><Button variant="ghost" disabled={busy || loading} onClick={() => { setOlder([]); setCursor(undefined); refresh(); }}>Refresh</Button>
        <Button disabled={busy || !inbox.unread_count} onClick={() => perform(async () => { await awarenessApi.readAll(); setOlder([]); setCursor(undefined); refresh(); })}>Mark all read</Button></div></div>
    {(error || actionError) && <p role="alert" className="text-sm text-critical">{actionError || 'Could not load notifications. Use Refresh to retry.'}</p>}
    {loading && <p role="status" className="text-xs text-muted">Loading notifications…</p>}
    {!loading && !error && !rows.length && <p className="py-8 text-center text-sm text-muted">No notifications yet.</p>}
    {!error && <ul className="space-y-2">{rows.map(n => <li key={n.id} className={`rounded-ds-sm border border-line p-3 ${n.read_at ? 'bg-surface' : 'bg-brand-soft'}`}>
      <button disabled={busy} onClick={() => open(n)} className="w-full text-left focus-visible:outline-brand">
        <span className="flex flex-wrap items-center gap-2 text-xs font-bold">{labels[n.event] || n.event}{!n.read_at && <Badge variant="brand">Unread</Badge>}</span>
        <span className="mt-1 block text-sm text-ink">{n.reference} · {n.title}</span>
        <time className="mt-1 block text-xs text-muted" dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time>
      </button>
      {!n.read_at && <button disabled={busy} onClick={() => mark(n)} className="mt-2 text-xs font-bold text-brand-strong">Mark read</button>}
    </li>)}</ul>}
    {!error && next && <Button disabled={busy} onClick={() => perform(async () => { const { data } = await awarenessApi.notifications(next); setOlder(rows => [...rows, ...data.items]); setCursor(data.next_before); })}>Load older</Button>}
  </div>;
}
