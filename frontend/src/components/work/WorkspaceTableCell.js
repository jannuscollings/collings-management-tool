import { useState } from "react";
import { X } from "lucide-react";
import { WORK_PRIORITY_OPTIONS, WORK_STATUS_OPTIONS } from "../../api/work";
import Badge from "../ui/Badge";
import { Input, Select } from "../ui/Field";
import DueDate from "./DueDate";

const statusLabels = Object.fromEntries(WORK_STATUS_OPTIONS);
const statusVariants = { new: "neutral", in_progress: "info", review: "review", done: "success" };
const priorityVariants = { low: "neutral", medium: "neutral", high: "warning" };
const tableEditorClass = "absolute left-[13px] top-1/2 z-10 h-7 min-h-7 max-w-[calc(100%-26px)] -translate-y-1/2 rounded-ds-xs border-brand/70 bg-surface px-2 py-0 text-[11.5px] leading-tight text-ink shadow-panel focus:border-brand focus:ring-2 focus:ring-brand/20";
const tableWidths = { status: "w-[132px]", priority: "w-[112px]", owner: "w-[168px]", reviewer: "w-[168px]", due_date: "w-[155px]" };

export default function WorkspaceTableCell({ item, field, users, canEdit, busy, onSave, inTable = false }) {
  const [editing, setEditing] = useState(false);
  const value = item[field] ?? "";
  const display = field === "status" ? <Badge variant={statusVariants[value]}>{statusLabels[value]}</Badge>
    : field === "priority" ? <Badge variant={priorityVariants[value]} className="capitalize">{value}</Badge>
      : field === "owner" || field === "reviewer" ? item[`${field}_detail`]?.display_name || "Unassigned"
        : field === "due_date" ? <DueDate item={item} /> : value || "—";
  const save = async (next) => {
    setEditing(false);
    if (String(next) !== String(value)) await onSave(item, field, next);
  };

  if (!canEdit) return display;
  if (busy) return <span role="status" className="text-xs text-brand-strong">Saving…</span>;
  if (editing) {
    if (field === "due_date") return inTable ? <>
      <span className="invisible" aria-hidden="true">{display}</span>
      <span className="absolute left-[13px] top-1/2 z-10 inline-flex max-w-[calc(100%-26px)] -translate-y-1/2 items-center gap-1">
        <Input autoFocus aria-label={`Edit due date for ${item.reference}`} type="date" value={value} onChange={(event) => save(event.target.value || null)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }} onBlur={() => setEditing(false)} className={`h-7 min-h-7 min-w-0 ${tableWidths.due_date} max-w-full rounded-ds-xs border-brand/70 px-1.5 py-0 text-[11.5px] shadow-panel focus:border-brand focus:ring-2 focus:ring-brand/20`} />
        {value && <button type="button" className="grid h-6 w-6 shrink-0 place-items-center rounded-ds-xs text-muted hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30" onMouseDown={(event) => event.preventDefault()} onClick={() => save(null)} aria-label={`Clear due date for ${item.reference}`} title="Clear due date"><X className="h-3.5 w-3.5" /></button>}
      </span>
    </> : <span className="flex min-w-[160px] items-center gap-1">
      <Input autoFocus aria-label={`Edit due date for ${item.reference}`} type="date" value={value} onChange={(event) => save(event.target.value || null)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }} onBlur={() => setEditing(false)} />
      {value && <button type="button" className="text-xs text-muted hover:text-copy" onMouseDown={(event) => event.preventDefault()} onClick={() => save(null)} aria-label={`Clear due date for ${item.reference}`}>Clear</button>}
    </span>;
    const needsReviewer = field === "status" && ["new", "in_progress"].includes(item.status) && !item.permissions.statuses.includes("review");
    const guidance = "Assign an active reviewer to submit for review.";
    const guidanceId = `review-guidance-${inTable ? "table" : "mobile"}-${item.id}`;
    const options = field === "status" ? WORK_STATUS_OPTIONS.filter(([key]) => item.permissions.statuses.includes(key) || (key === "review" && needsReviewer))
      : field === "priority" ? WORK_PRIORITY_OPTIONS
        : [["", "Unassigned"], ...users.map((user) => [String(user.id), user.display_name])];
    return <>
      {inTable && <span className="invisible" aria-hidden="true">{display}</span>}
      <Select autoFocus aria-label={`Edit ${field} for ${item.reference}`} aria-describedby={needsReviewer ? guidanceId : undefined} title={needsReviewer ? guidance : undefined} value={String(value)} onChange={(event) => save(field === "owner" || field === "reviewer" ? (event.target.value ? Number(event.target.value) : null) : event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }} onBlur={() => setEditing(false)} className={inTable ? `${tableEditorClass} ${tableWidths[field]} truncate` : "min-w-[130px]"}>{options.map(([key, label]) => <option key={key} value={key} disabled={key === "review" && needsReviewer}>{key === "review" && needsReviewer ? "Review — assign an active reviewer" : label}</option>)}</Select>
      {needsReviewer && <span id={guidanceId} className="sr-only">{guidance}</span>}
    </>;
  }
  return <button type="button" className="rounded-ds-xs text-left hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30" onClick={() => setEditing(true)} aria-label={`Edit ${field} for ${item.reference}`}>{display}</button>;
}
