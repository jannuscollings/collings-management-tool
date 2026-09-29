import { useEffect, useRef, useState } from 'react';
import { workApi } from '../../api/work';
import { Button } from '../ui/Button';
import { Field, Textarea } from '../ui/Field';
import Panel from '../ui/Panel';

// Email is unique and gives plain-text mentions an unambiguous, readable token.
const token = (user) => `@${user.email}`;
const stamp = (value) => new Date(value).toLocaleString();

function Composer({ users, initial, busy, label, onSave, onCancel, source, onDraftDirty }) {
  const [body, setBody] = useState(initial?.body || '');
  const [selected, setSelected] = useState(initial?.mention_details || []);
  const [query, setQuery] = useState(null);
  const [index, setIndex] = useState(0);
  const input = useRef(null);
  useEffect(() => {
    onDraftDirty(source, initial ? body.trim() !== initial.body.trim() : Boolean(body.trim()));
    return () => onDraftDirty(source, false);
  }, [body, initial, source, onDraftDirty]);
  const suggestions = query ? users.filter((user) => `${user.display_name} ${user.email}`.toLowerCase().includes(query.text.toLowerCase())).slice(0, 6) : [];
  const detect = (element) => {
    const end = element.selectionStart;
    const match = element.value.slice(0, end).match(/(?:^|\s)@([^\s@]*)$/);
    setQuery(match ? { start: end - match[1].length - 1, end, text: match[1] } : null);
    setIndex(0);
  };
  const choose = (user) => {
    const next = body.slice(0, query.start) + token(user) + ' ' + body.slice(query.end);
    const caret = query.start + token(user).length + 1;
    setBody(next);
    setSelected((current) => [...current.filter((person) => person.id !== user.id), user]);
    setQuery(null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(caret, caret); });
  };
  return <form className="min-w-0 space-y-3" onSubmit={async (event) => {
    event.preventDefault();
    const mentions = selected.filter((person) => body.includes(token(person))).map((person) => person.id);
    if (await onSave({ body: body.trim(), mentions })) { setBody(''); setSelected([]); setQuery(null); }
  }}>
    <Field label={label} hint="Type @ to mention an active user. Mentions send notifications.">
      <Textarea ref={input} required rows={3} maxLength={10000} disabled={busy} value={body}
        onChange={(event) => { setBody(event.target.value); detect(event.target); }}
        onClick={(event) => detect(event.target)}
        onKeyDown={(event) => {
          if (!query) return;
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setQuery(null); }
          if (suggestions.length && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
            event.preventDefault();
            if (event.key === 'Enter') choose(suggestions[index % suggestions.length]);
            else setIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
          }
        }} />
    </Field>
    {query && <div className="rounded-ds-sm border border-line bg-surface p-1" aria-label="Mention suggestions">
      {suggestions.length ? suggestions.map((person, position) => <button key={person.id} type="button" onClick={() => choose(person)}
        className={`block min-h-11 w-full rounded-ds-xs px-3 py-2 text-left text-xs hover:bg-brand-soft focus:bg-brand-soft shell:min-h-0 ${position === index ? 'bg-brand-soft text-brand-strong' : 'text-copy'}`}>
        <span className="font-bold">{person.display_name}</span><span className="ml-2 break-all text-muted">{person.email}</span>
      </button>) : <p className="p-2 text-xs text-muted">No matching users.</p>}
    </div>}
    <div className="flex flex-wrap justify-end gap-2">{onCancel && <Button variant="ghost" disabled={busy} onClick={onCancel} className="min-h-11 shell:min-h-[38px]">Cancel</Button>}<Button type="submit" disabled={busy || !body.trim()} className="min-h-11 shell:min-h-[38px]">{busy ? 'Saving…' : label}</Button></div>
  </form>;
}

function Comment({ comment, users, busy, onEdit, onDelete, onDraftDirty }) {
  const [editing, setEditing] = useState(false);
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-bold text-copy">{comment.author_detail.display_name}</span>
      <span className="text-[10px] text-muted"><time dateTime={comment.created_at}>{stamp(comment.created_at)}</time>{comment.edited_at && ' · edited'}</span>
    </div>
    {editing ? <Composer users={users} initial={comment} busy={busy} label="Save comment" source={`comment:${comment.id}`} onDraftDirty={onDraftDirty} onCancel={() => setEditing(false)} onSave={async (payload) => {
      const saved = await onEdit(comment.id, payload); if (saved) setEditing(false); return saved;
    }} /> : <>
      <p className={`whitespace-pre-wrap break-all text-[13px] leading-6 shell:break-words ${comment.deleted_at ? 'italic text-muted' : 'text-copy'}`}>{comment.deleted_at ? 'This comment was deleted.' : comment.body}</p>
      {!comment.deleted_at && comment.mention_details.length > 0 && <div className="flex flex-wrap gap-1">{comment.mention_details.map((person) => <span key={person.id} className="rounded-ds-xs bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand-strong">@{person.display_name}</span>)}</div>}
      {comment.can_manage && <div className="flex gap-3 text-[11px] font-bold"><button disabled={busy} className="min-h-11 text-brand-strong hover:underline shell:min-h-0" onClick={() => setEditing(true)}>Edit</button><button disabled={busy} className="min-h-11 text-critical hover:underline shell:min-h-0" onClick={() => { if (window.confirm('Delete this comment? Replies and activity will be preserved.')) onDelete(comment.id); }}>Delete</button></div>}
    </>}
  </div>;
}

export default function WorkDiscussion({ itemId, comments, users, busy, run, onDraftDirty, hasDirty }) {
  const [replyTo, setReplyTo] = useState(null);
  const [expanded, setExpanded] = useState({});
  const onEdit = (id, payload) => run(() => workApi.editComment(itemId, id, payload));
  const onDelete = (id) => run(() => workApi.deleteComment(itemId, id));
  const confirmDiscard = (sources) => !sources.some(hasDirty) || window.confirm('Discard unsaved discussion draft?');
  return <Panel className="min-w-0 space-y-5 p-4 shell:p-5">
    <div><h2 className="text-sm font-extrabold text-ink">Discussion</h2><p className="mt-1 text-xs text-muted">Updates, questions and replies about this work.</p></div>
    <Composer users={users} busy={busy} label="Post update" source="comment:new" onDraftDirty={onDraftDirty} onSave={(payload) => run(() => workApi.createComment(itemId, payload))} />
    {!comments.length && <p className="border-t border-line pt-5 text-xs text-muted">No updates yet. Start the conversation.</p>}
    {comments.filter((comment) => !comment.parent).map((comment) => {
      const replies = comments.filter((reply) => reply.parent === comment.id);
      const open = expanded[comment.id] || replyTo === comment.id;
      return <section key={comment.id} className="space-y-3 border-t border-line pt-5">
        <Comment {...{ comment, users, busy, onEdit, onDelete, onDraftDirty }} />
        <div className="flex flex-wrap gap-3 text-[11px] font-bold text-brand-strong">
          {replies.length > 0 && <button className="min-h-11 shell:min-h-0" disabled={busy} aria-expanded={Boolean(open)} onClick={() => { if (!confirmDiscard([`reply:${replyTo}`, ...(open ? replies.map((reply) => `comment:${reply.id}`) : [])])) return; setExpanded((current) => ({ ...current, [comment.id]: !open })); setReplyTo(null); }}>{open ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</button>}
          {!comment.deleted_at && <button className="min-h-11 shell:min-h-0" disabled={busy} onClick={() => { if (replyTo !== comment.id && !confirmDiscard([`reply:${replyTo}`])) return; setReplyTo(comment.id); }}>Reply</button>}
        </div>
        {open && <div className="ml-0 min-w-0 space-y-5 border-l-2 border-line pl-3 shell:ml-4 shell:pl-4">
          {replies.map((reply) => <Comment key={reply.id} comment={reply} {...{ users, busy, onEdit, onDelete, onDraftDirty }} />)}
          {replyTo === comment.id && !comment.deleted_at && <Composer users={users} busy={busy} label="Post reply" source={`reply:${comment.id}`} onDraftDirty={onDraftDirty} onCancel={() => setReplyTo(null)} onSave={async (payload) => {
            const saved = await run(() => workApi.createComment(itemId, { ...payload, parent: comment.id }));
            if (saved) { setReplyTo(null); setExpanded((current) => ({ ...current, [comment.id]: true })); } return saved;
          }} />}
        </div>}
      </section>;
    })}
  </Panel>;
}
