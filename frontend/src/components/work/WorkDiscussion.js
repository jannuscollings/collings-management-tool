import { useEffect, useRef, useState } from 'react';
import { workApi } from '../../api/work';
import { Button } from '../ui/Button';
import { Field, Textarea } from '../ui/Field';
import Panel from '../ui/Panel';
import * as Dialog from '@radix-ui/react-dialog';

// Email is unique and gives plain-text mentions an unambiguous, readable token.
const token = (user) => `@${user.email}`;
const stamp = (value) => new Date(value).toLocaleString();
const isImage = (type) => type?.startsWith('image/');
const allowed = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.docx,.xlsx,.pptx';

function PostedAttachment({ itemId, commentId, attachment }) {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isImage(attachment.content_type)) return undefined;
    let active = true;
    let url;
    workApi.getCommentAttachment(itemId, commentId, attachment.id).then(({ data }) => {
      url = URL.createObjectURL(data);
      if (active) setImageUrl(url);
      else URL.revokeObjectURL(url);
    }).catch(() => { if (active) setError('Image unavailable'); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [itemId, commentId, attachment.id, attachment.content_type]);
  const download = async () => {
    try {
      const { data } = await workApi.getCommentAttachment(itemId, commentId, attachment.id);
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('File unavailable'); }
  };
  return <div className="min-w-0 max-w-full">
    {isImage(attachment.content_type) ? imageUrl && <Dialog.Root>
      <Dialog.Trigger asChild><button type="button" className="block min-h-11 max-w-full rounded-ds-sm border border-line p-1 text-left" aria-label={`View ${attachment.filename}`}>
        <img src={imageUrl} alt={attachment.filename} className="max-h-32 max-w-full rounded-ds-xs object-contain" />
      </button></Dialog.Trigger>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-black/75" />
        <Dialog.Content className="fixed inset-4 z-[81] flex min-w-0 flex-col items-center justify-center gap-3 outline-none" aria-describedby={undefined}>
          <Dialog.Title className="max-w-full break-all text-center text-sm font-bold text-white">{attachment.filename}</Dialog.Title>
          <img src={imageUrl} alt={attachment.filename} className="max-h-[75vh] max-w-full object-contain" />
          <Dialog.Close className="min-h-11 rounded-ds-sm bg-surface px-5 text-sm font-bold text-ink">Close image</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root> : !isImage(attachment.content_type) &&
      <button type="button" onClick={download} className="min-h-11 max-w-full break-all text-left text-xs font-bold text-brand-strong hover:underline">Download {attachment.filename}</button>}
    {error && <p role="alert" className="text-xs text-critical">{error}</p>}
  </div>;
}

function Composer({ users, initial, busy, label, onSave, onCancel, source, onDraftDirty }) {
  const [body, setBody] = useState(initial?.body || '');
  const [selected, setSelected] = useState(initial?.mention_details || []);
  const [query, setQuery] = useState(null);
  const [index, setIndex] = useState(0);
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const input = useRef(null);
  const mounted = useRef(true);
  const previewUrls = useRef(new Set());
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; previewUrls.current.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);
  useEffect(() => {
    onDraftDirty(source, initial ? body.trim() !== initial.body.trim() : Boolean(body.trim()) || files.length > 0);
    return () => onDraftDirty(source, false);
  }, [body, files.length, initial, source, onDraftDirty]);
  const addFiles = (incoming) => {
    if (initial || !incoming.length) return;
    const next = [...files.map((entry) => entry.file), ...incoming];
    if (next.length > 5 || next.some((file) => file.size > 10 * 1024 * 1024) ||
        next.reduce((size, file) => size + file.size, 0) > 25 * 1024 * 1024) {
      setFileError('Attach up to 5 files, 10 MB each and 25 MB combined.');
      return;
    }
    const added = incoming.map((file) => ({ file, url: isImage(file.type) ? URL.createObjectURL(file) : '' }));
    added.forEach((entry) => { if (entry.url) previewUrls.current.add(entry.url); });
    setFiles((current) => [...current, ...added]);
    setFileError('');
  };
  const removeFile = (position) => {
    const entry = files[position];
    if (entry.url) { URL.revokeObjectURL(entry.url); previewUrls.current.delete(entry.url); }
    setFiles((current) => current.filter((_, index) => index !== position));
  };
  const suggestions = query ? users.filter((user) => `${user.display_name} ${user.email}`.toLowerCase().includes(query.text.toLowerCase())) : [];
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
    if (await onSave({ body: body.trim(), mentions, ...(files.length ? { attachments: files.map((entry) => entry.file) } : {}) }) && mounted.current) {
      files.forEach((entry) => { if (entry.url) { URL.revokeObjectURL(entry.url); previewUrls.current.delete(entry.url); } });
      setBody(''); setSelected([]); setQuery(null); setFiles([]); setFileError('');
    }
  }}>
    <Field label={label} hint="Type @ to mention an active user. Mentions send notifications.">
      <Textarea ref={input} required={!files.length} rows={3} maxLength={10000} disabled={busy} value={body}
        onPaste={(event) => {
          if (initial) return;
          const images = Array.from(event.clipboardData?.items || []).filter((entry) => isImage(entry.type))
            .map((entry) => entry.getAsFile()).filter(Boolean);
          if (images.length) { event.preventDefault(); addFiles(images); }
        }}
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
    {!initial && <>
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-ds-sm border border-line px-3 text-xs font-bold text-brand-strong">
        Add attachments<input type="file" aria-label={`Add attachments to ${label.toLowerCase()}`} multiple accept={allowed} disabled={busy}
          className="sr-only" onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      </label>
      {files.length > 0 && <ul className="flex min-w-0 flex-wrap gap-2" aria-label="Selected attachments">{files.map((entry, position) =>
        <li key={position} className="min-w-0 max-w-full rounded-ds-sm border border-line p-2 text-xs text-copy">
          {entry.url && <img src={entry.url} alt="" className="mb-2 max-h-24 max-w-full object-contain" />}
          <span className="block max-w-full break-all">{entry.file.name}</span>
          <button type="button" disabled={busy} onClick={() => removeFile(position)} className="min-h-11 font-bold text-critical">Remove {entry.file.name}</button>
        </li>)}</ul>}
      {fileError && <p role="alert" className="text-xs text-critical">{fileError}</p>}
    </>}
    <div className="flex flex-wrap justify-end gap-2">{onCancel && <Button variant="ghost" disabled={busy} onClick={onCancel} className="min-h-11 shell:min-h-[38px]">Cancel</Button>}<Button type="submit" disabled={busy || (!body.trim() && !files.length)} className="min-h-11 shell:min-h-[38px]">{busy ? 'Saving…' : label}</Button></div>
  </form>;
}

function Comment({ itemId, comment, users, busy, onEdit, onDelete, onDraftDirty }) {
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
    {!comment.deleted_at && comment.attachments?.length > 0 && <div className="flex min-w-0 flex-wrap gap-3" aria-label="Posted attachments">
      {comment.attachments.map((attachment) => <PostedAttachment key={attachment.id} itemId={itemId} commentId={comment.id} attachment={attachment} />)}
    </div>}
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
        <Comment {...{ itemId, comment, users, busy, onEdit, onDelete, onDraftDirty }} />
        <div className="flex flex-wrap gap-3 text-[11px] font-bold text-brand-strong">
          {replies.length > 0 && <button className="min-h-11 shell:min-h-0" disabled={busy} aria-expanded={Boolean(open)} onClick={() => { if (!confirmDiscard([`reply:${replyTo}`, ...(open ? replies.map((reply) => `comment:${reply.id}`) : [])])) return; setExpanded((current) => ({ ...current, [comment.id]: !open })); setReplyTo(null); }}>{open ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</button>}
          {!comment.deleted_at && <button className="min-h-11 shell:min-h-0" disabled={busy} onClick={() => { if (replyTo !== comment.id && !confirmDiscard([`reply:${replyTo}`])) return; setReplyTo(comment.id); }}>Reply</button>}
        </div>
        {open && <div className="ml-0 min-w-0 space-y-5 border-l-2 border-line pl-3 shell:ml-4 shell:pl-4">
          {replies.map((reply) => <Comment key={reply.id} comment={reply} {...{ itemId, users, busy, onEdit, onDelete, onDraftDirty }} />)}
          {replyTo === comment.id && !comment.deleted_at && <Composer users={users} busy={busy} label="Post reply" source={`reply:${comment.id}`} onDraftDirty={onDraftDirty} onCancel={() => setReplyTo(null)} onSave={async (payload) => {
            const saved = await run(() => workApi.createComment(itemId, { ...payload, parent: comment.id }));
            if (saved) { setReplyTo(null); setExpanded((current) => ({ ...current, [comment.id]: true })); } return saved;
          }} />}
        </div>}
      </section>;
    })}
  </Panel>;
}
