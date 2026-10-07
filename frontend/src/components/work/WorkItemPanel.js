import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Archive, Check, ExternalLink, Loader2, Pencil, Plus, X } from "lucide-react";
import WorkDiscussion from "./WorkDiscussion";
import toast from "react-hot-toast";
import { workApi, WORK_STATUS_OPTIONS, WORK_PRIORITY_OPTIONS } from "../../api/work";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";
import Panel from "../ui/Panel";
import DueDate from "./DueDate";
import ProfileAvatar from "../profile/ProfileAvatar";

const statusVariants = { new: "neutral", in_progress: "info", review: "review", done: "success" };
const statusLabel = (value) => WORK_STATUS_OPTIONS.find(([key]) => key === value)?.[1] || value;
const stamp = (value) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const errorMessage = (error) => {
  const data = error.response?.data;
  if (!data) return "Couldn't save. Please try again.";
  if (data.detail) return data.detail;
  return Object.entries(data).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : value}`).join(' · ');
};
const activityLabels = {
  reply_added: "Replied to a comment", comment_edited: "Edited a comment", comment_deleted: "Deleted a comment",
  created: "Created this work item", status_changed: "Changed status", review_submitted: "Submitted for review",
  approved: "Approved the work", changes_requested: "Requested changes", owner_id_changed: "Changed owner",
  reviewer_id_changed: "Changed reviewer", priority_changed: "Changed priority", due_date_changed: "Changed due date",
  start_date_added: "Start date added", start_date_changed: "Start date changed", start_date_cleared: "Start date cleared",
  title_changed: "Updated title", brief_changed: "Updated brief", group_id_changed: "Moved group",
  sub_work_created: "Created sub-work", sub_work_updated: "Updated sub-work", sub_work_completed: "Completed sub-work",
  sub_work_reopened: "Reopened sub-work", comment_added: "Added an update", link_added: "Added a link", link_removed: "Removed a link",
  archived: "Archived this work item", restored: "Restored this work item",
};
function Identity({ person }) {
  const name = person?.display_name || "Unassigned";
  return <span className="inline-flex min-w-0 items-center gap-2">{person && <ProfileAvatar user={person} otherUser className="h-7 w-7 text-[10px]" />}<span className="truncate">{name}</span></span>;
}
function Section({ title, description, children, action }) {
  return <Panel className="min-w-0 p-4 shell:p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-3 shell:flex-nowrap"><div className="min-w-0"><h2 className="break-words text-sm font-extrabold text-ink">{title}</h2>{description && <p className="mt-1 break-words text-xs text-muted">{description}</p>}</div>{action}</div>{children}</Panel>;
}
function CoreEditor({ item, groups, users, busy, onSave, onCancel, onDirty }) {
  const [form, setForm] = useState({ title: item.title, brief: item.brief, group: item.group, status: item.status, priority: item.priority, owner: item.owner || '', reviewer: item.reviewer || '', start_date: item.start_date || '', due_date: item.due_date || '' });
  useEffect(() => {
    const saved = { title: item.title, brief: item.brief, group: item.group, status: item.status, priority: item.priority, owner: item.owner || '', reviewer: item.reviewer || '', start_date: item.start_date || '', due_date: item.due_date || '' };
    onDirty?.(Object.keys(saved).some((key) => String(form[key]) !== String(saved[key])));
    return () => onDirty?.(false);
  }, [form, item, onDirty]);
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    let payload = { title: form.title.trim(), brief: form.brief, status: form.status };
    if (item.permissions.manage) payload = { ...payload, group: Number(form.group), priority: form.priority, owner: form.owner ? Number(form.owner) : null, reviewer: form.reviewer ? Number(form.reviewer) : null, start_date: form.start_date || null, due_date: form.due_date || null };
    onSave(payload);
  };
  return <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <Field label="Title" className="sm:col-span-2"><Input required maxLength={200} value={form.title} onChange={change('title')} /></Field>
    <Field label="Brief" className="sm:col-span-2"><Textarea rows={5} value={form.brief} onChange={change('brief')} /></Field>
    <Field label="Status"><Select value={form.status} onChange={change('status')}>{WORK_STATUS_OPTIONS.filter(([value]) => item.permissions.statuses.includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
    {item.permissions.manage && <>
      <Field label="Group"><Select value={form.group} onChange={change('group')}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></Field>
      <Field label="Priority"><Select value={form.priority} onChange={change('priority')}>{WORK_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <Field label="Start date"><Input type="date" value={form.start_date} onChange={change('start_date')} /></Field>
      <Field label="Due date"><Input type="date" value={form.due_date} onChange={change('due_date')} /></Field>
      {['owner', 'reviewer'].map((key) => <Field key={key} label={key}><Select value={form[key]} onChange={change(key)}><option value="">Unassigned</option>{item[key] && !users.some((person) => person.id === item[key]) && <option value={item[key]}>{item[`${key}_detail`]?.display_name || "Former team member"} (inactive)</option>}{users.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</Select></Field>)}
    </>}
    <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><Button variant="secondary" disabled={busy} onClick={onCancel} className="min-h-11 shell:min-h-[38px]">Cancel</Button><Button type="submit" disabled={busy} className="min-h-11 shell:min-h-[38px]">{busy ? 'Saving…' : 'Save changes'}</Button></div>
  </form>;
}
function SubWorkRow({ sub, users, manage, userId, busy, onSave, onDraftDirty }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(sub.title);
  const [assignee, setAssignee] = useState(sub.assignee || '');
  useEffect(() => {
    onDraftDirty(`sub-work:${sub.id}`, editing && (title !== sub.title || String(assignee) !== String(sub.assignee || '')));
    return () => onDraftDirty(`sub-work:${sub.id}`, false);
  }, [editing, title, assignee, sub.id, sub.title, sub.assignee, onDraftDirty]);
  return <li className="border-t border-line py-3 first:border-0">
    {editing ? <form className="grid gap-2 sm:grid-cols-[1fr_150px_auto]" onSubmit={async (event) => { event.preventDefault(); if (await onSave({ title, assignee: assignee ? Number(assignee) : null })) setEditing(false); }}>
      <Input aria-label="Sub-work title" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
      <Select aria-label="Sub-work assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option>{sub.assignee && !users.some((person) => person.id === sub.assignee) && <option value={sub.assignee}>{sub.assignee_detail?.display_name || "Former team member"} (inactive)</option>}{users.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</Select>
      <div className="flex gap-1"><Button type="submit" disabled={busy} className="min-h-11 shell:min-h-[38px]">Save</Button><Button variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel editing" className="min-h-11 shell:min-h-[38px]"><X className="h-4 w-4" /></Button></div>
    </form> : <div className="flex items-center gap-3">
      <label className="grid min-h-11 min-w-11 shrink-0 place-items-center shell:min-h-0 shell:min-w-0"><input type="checkbox" checked={sub.completed} disabled={busy || (!manage && sub.assignee !== userId)} onChange={(event) => onSave({ completed: event.target.checked })} aria-label={`${sub.completed ? 'Reopen' : 'Complete'} ${sub.title}`} className="h-4 w-4 accent-primary" /></label>
      <div className="min-w-0 flex-1"><p className={`break-words text-[13px] font-semibold ${sub.completed ? 'text-muted line-through' : 'text-copy'}`}>{sub.title}</p><p className="mt-1 break-words text-[11px] text-muted">{sub.assignee_detail?.display_name || 'Unassigned'}</p></div>
      {manage && <Button size="icon" variant="ghost" aria-label={`Edit ${sub.title}`} onClick={() => { setTitle(sub.title); setAssignee(sub.assignee || ''); setEditing(true); }} className="min-h-11 min-w-11 shell:min-h-[38px] shell:min-w-[38px]"><Pencil className="h-3.5 w-3.5" /></Button>}
    </div>}
  </li>;
}

export default function WorkItemPanel({ itemId, expectedWorkspace, drawer, onChanged, onArchived, onDirty, onBusy }) {
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [subs, setSubs] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState('overview');
  const [subTitle, setSubTitle] = useState('');
  const [subAssignee, setSubAssignee] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [note, setNote] = useState('');
  const [draftDirty, setDraftDirty] = useState(false);
  const [retry, setRetry] = useState(0);
  const dirtySources = useRef(new Set());
  const markDirty = useCallback((source, value) => {
    if (value) dirtySources.current.add(source);
    else dirtySources.current.delete(source);
    const dirty = dirtySources.current.size > 0;
    setDraftDirty(dirty);
    onDirty?.(dirty);
  }, [onDirty]);
  const hasDirty = useCallback((source) => dirtySources.current.has(source), []);
  const setCoreDirty = useCallback((value) => markDirty('core', value), [markDirty]);

  useEffect(() => { markDirty('review-note', Boolean(item?.permissions.review && note.trim())); }, [item?.permissions.review, note, markDirty]);
  useEffect(() => { markDirty('sub-work:new', Boolean(item?.permissions.manage && (subTitle.trim() || subAssignee))); }, [item?.permissions.manage, subTitle, subAssignee, markDirty]);
  useEffect(() => { markDirty('link:new', Boolean(item?.permissions.edit && (linkLabel.trim() || linkUrl.trim()))); }, [item?.permissions.edit, linkLabel, linkUrl, markDirty]);

  const loadRecords = async () => {
    const [detail, discussion, history, subWork, resources] = await Promise.all([
      workApi.getItem(itemId), workApi.listComments(itemId), workApi.listActivity(itemId), workApi.listSubWork(itemId), workApi.listLinks(itemId),
    ]);
    return { detail: detail.data, comments: discussion.data, activity: history.data, subs: subWork.data, links: resources.data };
  };
  const applyRecords = (data) => { setItem(data.detail); setComments(data.comments); setActivity(data.activity); setSubs(data.subs); setLinks(data.links); };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        const data = await loadRecords();
        if (expectedWorkspace && data.detail.workspace_slug !== expectedWorkspace) throw new Error('Workspace mismatch');
        const [workspace, people] = await Promise.all([workApi.getWorkspace(data.detail.workspace_slug), workApi.listUsers()]);
        if (!active) return;
        applyRecords(data); setGroups(workspace.data.groups); setUsers(people.data);
      } catch { if (active) setError("This work item couldn't be loaded or is not available to your account."); }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
    // Each item opens a fresh editor; mutations refresh the persisted records below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, expectedWorkspace, retry]);

  const run = async (operation) => {
    if (busy) return false;
    setBusy(true); onBusy?.(true); setError('');
    try {
      await operation();
      onChanged?.();
      try { applyRecords(await loadRecords()); }
      catch { setError('Saved, but the latest details could not be reloaded. Close and reopen this item.'); }
      return true;
    } catch (failure) { const message = errorMessage(failure); setError(message); toast.error(message); return false; }
    finally { setBusy(false); onBusy?.(false); }
  };
  const archiveItem = async () => {
    if (busy || draftDirty || editing || !window.confirm(`Archive ${item.reference}? Its work and history will be preserved.`)) return;
    setBusy(true); onBusy?.(true);
    try {
      await workApi.archiveItem(itemId);
      onChanged?.();
      toast.success(`${item.reference} archived`);
      onBusy?.(false);
      if (drawer) onArchived?.();
      else navigate(`/workspaces/${item.workspace_slug}`);
    } catch (failure) { const message = errorMessage(failure); setError(message); toast.error(message); }
    finally { setBusy(false); onBusy?.(false); }
  };
  if (loading) return <div role="status" className="flex items-center gap-2 py-12 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading work item…</div>;
  if (!item) return <Panel className="p-6"><p role="alert" className="text-sm text-critical">{error}</p><Button className="mt-4" variant="secondary" onClick={() => setRetry((value) => value+1)}>Try again</Button></Panel>;
  const permissions = item.permissions;
  return <div className="min-w-0 space-y-5">
    <header className="pb-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><p className="break-all font-mono text-xs font-semibold text-muted">{item.reference}</p>{drawer && <Link to={`/workspaces/${item.workspace_slug}/items/${item.id}`} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-brand-strong shell:min-h-0">Full page <ExternalLink className="h-3.5 w-3.5" /></Link>}</div>
      <h1 className="mt-3 break-words text-2xl font-extrabold leading-tight tracking-tight text-ink">{item.title}</h1>
      <p className="mt-2 break-words text-xs text-muted">{item.workspace_name} <span className="mx-1">/</span> {item.group_name}</p>
      <div className="mt-4 flex flex-wrap gap-2"><Badge variant={statusVariants[item.status]}>{statusLabel(item.status)}</Badge><Badge variant={item.priority === 'high' ? 'warning' : 'neutral'} className="capitalize">{item.priority} priority</Badge>{busy && <span role="status" className="text-xs text-brand-strong">Saving…</span>}</div>
      {permissions.manage && <Button variant="secondary" className="mt-4 min-h-11 shell:min-h-[38px]" disabled={busy || draftDirty || editing} onClick={archiveItem}><Archive className="h-4 w-4" /> Archive work item</Button>}
    </header>
    {error && <Panel role="alert" className="border-critical/30 p-4 text-sm text-critical">{error}</Panel>}
    {item.outstanding_review_feedback && <Panel className="border-warning/40 p-4 shell:p-5">
      <h2 className="text-sm font-extrabold text-ink">Changes requested</h2>
      <p className="mt-1 text-xs text-muted">Requested by {item.outstanding_review_feedback.requested_by}</p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-copy">{item.outstanding_review_feedback.note}</p>
    </Panel>}
    {item.owner === user?.id && ['new', 'in_progress'].includes(item.status) && <Panel className="p-4 shell:p-5">
      <h2 className="text-sm font-extrabold text-ink">Ready for review?</h2>
      {permissions.statuses.includes('review') ? <>
        <p className="mt-1 text-xs text-muted">Send this work to {item.reviewer_detail?.display_name} for a decision.</p>
        <Button className="mt-3 min-h-11 shell:min-h-[38px]" disabled={busy || draftDirty || editing} onClick={() => run(() => workApi.updateItem(itemId, { status: 'review' }))}>
          {item.outstanding_review_feedback ? 'Resubmit for review' : 'Submit for review'}
        </Button>
        {(draftDirty || editing) && <p className="mt-2 text-xs text-muted">Save or discard your drafts before submitting.</p>}
      </> : <p className="mt-1 text-xs text-muted">{permissions.manage ? 'Assign an active reviewer before submitting for review.' : 'Ask an administrator to assign an active reviewer before submitting for review.'}</p>}
    </Panel>}
    {item.status === 'review' && <Panel className="border-review/25 p-4 shell:p-5"><h2 className="text-sm font-extrabold text-ink">Awaiting review</h2><p className="mt-1 break-words text-xs text-muted">{item.reviewer_detail?.display_name} is assigned to review this work.</p>{permissions.review && <div className="mt-4 space-y-3"><Field label="Review note" hint="Required when requesting changes."><Textarea value={note} maxLength={10000} onChange={(event) => setNote(event.target.value)} rows={2} /></Field><div className="flex flex-wrap gap-2"><Button className="min-h-11 shell:min-h-[38px]" disabled={busy} onClick={async () => { if (await run(() => workApi.review(itemId, { decision: 'approve', note }))) setNote(''); }}><Check className="h-4 w-4" /> Approve</Button><Button className="min-h-11 shell:min-h-[38px]" variant="secondary" disabled={busy || !note.trim()} onClick={async () => { if (await run(() => workApi.review(itemId, { decision: 'request_changes', note }))) setNote(''); }}>Request changes</Button></div></div>}</Panel>}
    <nav aria-label="Work item sections" className="flex gap-1 overflow-x-auto whitespace-nowrap border-b border-line pb-2 shell:overflow-visible">
      {[['overview', 'Overview'], ['updates', `Updates (${comments.length})`], ['activity', 'Activity']].map(([value, label]) => <Button key={value} variant={tab === value ? 'secondary' : 'ghost'} aria-pressed={tab === value} onClick={() => setTab(value)} className="min-h-11 shrink-0 shell:min-h-[38px]">{label}</Button>)}
    </nav>
    <div hidden={tab !== 'overview'} className="space-y-5">
      <Section title="Delivery details" action={permissions.edit && !editing && <Button variant="ghost" disabled={busy} onClick={() => setEditing(true)} className="min-h-11 shell:min-h-[38px]"><Pencil className="h-3.5 w-3.5" /> Edit</Button>}>
        {editing ? <CoreEditor item={item} groups={groups} users={users} busy={busy} onDirty={setCoreDirty} onCancel={() => setEditing(false)} onSave={async (payload) => { if (await run(() => workApi.updateItem(itemId, payload))) setEditing(false); }} /> : <>
          <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-copy">{item.brief || 'No brief added yet.'}</p>
          <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-4"><div><dt className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Owner</dt><dd className="text-xs text-copy"><Identity person={item.owner_detail} /></dd></div><div><dt className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Reviewer</dt><dd className="text-xs text-copy"><Identity person={item.reviewer_detail} /></dd></div><div><dt className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Start date</dt><dd className="pt-1 text-xs font-semibold text-copy">{item.start_date || 'Not set'}</dd></div><div><dt className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Due date</dt><dd className="pt-1 text-xs font-semibold text-copy"><DueDate item={item} empty="Not set" /></dd></div></dl>
        </>}
      </Section>
      <Section title="Sub-work" description={`${subs.filter((sub) => sub.completed).length} of ${subs.length} complete`}>
        {subs.length ? <ul>{subs.map((sub) => <SubWorkRow key={sub.id} sub={sub} users={users} manage={permissions.manage} userId={user.id} busy={busy} onSave={(payload) => run(() => workApi.updateSubWork(itemId, sub.id, payload))} onDraftDirty={markDirty} />)}</ul> : <p className="text-xs text-muted">Break this work into clear, assignable steps.</p>}
        {permissions.manage && <form className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1fr_150px_auto]" onSubmit={async (event) => { event.preventDefault(); if (await run(() => workApi.createSubWork(itemId, { title: subTitle.trim(), assignee: subAssignee ? Number(subAssignee) : null }))) { setSubTitle(''); setSubAssignee(''); } }}><Input aria-label="New sub-work title" placeholder="Add a step…" required maxLength={200} value={subTitle} onChange={(event) => setSubTitle(event.target.value)} /><Select aria-label="Assign sub-work" value={subAssignee} onChange={(event) => setSubAssignee(event.target.value)}><option value="">Unassigned</option>{users.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</Select><Button type="submit" disabled={busy || !subTitle.trim()} className="min-h-11 shell:min-h-[38px]"><Plus className="h-4 w-4" /> Add</Button></form>}
      </Section>
      <Section title="Files & links" description="Design files, source briefs and delivery resources.">
        {links.length ? <ul className="space-y-2">{links.map((link) => <li key={link.id} className="flex min-w-0 items-center gap-3 rounded-ds-xs border border-line p-3"><ExternalLink className="h-4 w-4 shrink-0 text-muted" /><a href={link.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all text-xs font-bold text-brand-strong shell:truncate">{link.label}</a>{permissions.edit && <Button variant="ghost" size="icon" aria-label={`Remove ${link.label}`} disabled={busy} onClick={() => { if (window.confirm(`Remove link “${link.label}”?`)) run(() => workApi.removeLink(itemId, link.id)); }} className="min-h-11 min-w-11 shell:min-h-[38px] shell:min-w-[38px]"><X className="h-4 w-4" /></Button>}</li>)}</ul> : <p className="text-xs text-muted">No links yet. Add a resource your team can open.</p>}
        {permissions.edit && <form className="mt-4 grid min-w-0 gap-2 border-t border-line pt-4 sm:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); if (await run(() => workApi.createLink(itemId, { label: linkLabel.trim(), url: linkUrl.trim() }))) { setLinkLabel(''); setLinkUrl(''); } }}><Input aria-label="Link label" placeholder="Label" required maxLength={160} value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} /><Input aria-label="Link URL" type="url" placeholder="https://…" required maxLength={2000} value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} /><Button type="submit" variant="secondary" disabled={busy} className="min-h-11 sm:col-span-2 sm:justify-self-end shell:min-h-[38px]">Add link</Button></form>}
      </Section>
    </div>
    <div hidden={tab !== 'updates'}><WorkDiscussion itemId={itemId} comments={comments} users={users} busy={busy} run={run} onDraftDirty={markDirty} hasDirty={hasDirty} /></div>
    {tab === 'activity' && <Section title="Activity" description="Recorded changes and review decisions.">
      {activity.length ? <ol className="space-y-5 border-l border-line pl-5">{activity.map((entry) => <li key={entry.id} className="relative break-words"><span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-brand" /><p className="text-xs font-bold text-copy">{activityLabels[entry.event] || entry.event}</p><p className="mt-1 text-[11px] text-muted">{entry.actor_detail.display_name} · {stamp(entry.created_at)}</p>{entry.details.note && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-copy">{entry.details.note}</p>}{(entry.details.title || entry.details.label || entry.details.request) && <p className="mt-1 text-xs text-copy">{entry.details.title || entry.details.label || entry.details.request}</p>}{'after' in entry.details && !['brief_changed', 'title_changed'].includes(entry.event) && <p className="mt-1 text-xs text-copy">{entry.details.before || (entry.event.startsWith('start_date_') ? 'Not set' : 'Unassigned')} → {entry.details.after || (entry.event.startsWith('start_date_') ? 'Not set' : 'Unassigned')}</p>}</li>)}</ol> : <p className="text-xs text-muted">No recorded activity yet. Earlier work is preserved; history starts with this update.</p>}
    </Section>}
  </div>;
}
