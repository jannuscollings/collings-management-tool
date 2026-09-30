import { useState } from "react";
import { WORK_PRIORITY_OPTIONS, WORK_STATUS_OPTIONS } from "../../api/work";
import Badge from "../ui/Badge";
import { Input, Select } from "../ui/Field";
import DueDate from "./DueDate";

const statusLabels = Object.fromEntries(WORK_STATUS_OPTIONS);
const statusVariants = { new: "neutral", in_progress: "info", review: "review", done: "success" };
const priorityVariants = { low: "neutral", medium: "neutral", high: "warning" };

export default function WorkspaceTableCell({ item, field, users, canEdit, busy, onSave }) {
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
    if (field === "due_date") return <span className="flex min-w-[160px] items-center gap-1">
      <Input autoFocus aria-label={`Edit due date for ${item.reference}`} type="date" value={value} onChange={(event) => save(event.target.value || null)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }} onBlur={() => setEditing(false)} />
      {value && <button type="button" className="text-xs text-muted hover:text-copy" onMouseDown={(event) => event.preventDefault()} onClick={() => save(null)} aria-label={`Clear due date for ${item.reference}`}>Clear</button>}
    </span>;
    const needsReviewer = field === "status" && ["new", "in_progress"].includes(item.status) && !item.permissions.statuses.includes("review");
    const options = field === "status" ? WORK_STATUS_OPTIONS.filter(([key]) => item.permissions.statuses.includes(key) || (key === "review" && needsReviewer))
      : field === "priority" ? WORK_PRIORITY_OPTIONS
        : [["", "Unassigned"], ...users.map((user) => [String(user.id), user.display_name])];
    return <span className="inline-flex flex-col gap-1"><Select autoFocus aria-label={`Edit ${field} for ${item.reference}`} value={String(value)} onChange={(event) => save(field === "owner" || field === "reviewer" ? (event.target.value ? Number(event.target.value) : null) : event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }} onBlur={() => setEditing(false)} className="min-w-[130px]">{options.map(([key, label]) => <option key={key} value={key} disabled={key === "review" && needsReviewer}>{label}</option>)}</Select>{needsReviewer && <span className="text-[10px] text-muted">Assign an active reviewer to submit for review.</span>}</span>;
  }
  return <button type="button" className="rounded-ds-xs text-left hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30" onClick={() => setEditing(true)} aria-label={`Edit ${field} for ${item.reference}`}>{display}</button>;
}
