import { useMemo, useState } from "react";
import { WorkItemLink } from "./WorkItemDrawer";
import { GripVertical, Loader2 } from "lucide-react";

import { WORK_STATUS_OPTIONS } from "../../api/work";
import Badge from "../ui/Badge";
import { Select } from "../ui/Field";
import DueDate from "./DueDate";

const PRIORITY_VARIANTS = {
  low: "neutral",
  medium: "neutral",
  high: "warning",
};

const STATUS_VARIANTS = {
  new: "neutral",
  in_progress: "info",
  review: "review",
  done: "success",
};

const STATUS_ACCENTS = {
  new: "bg-slate-400 dark:bg-slate-300",
  in_progress: "bg-info",
  review: "bg-review",
  done: "bg-positive",
};

export default function WorkspaceKanban({
  hasActiveFilters,
  items,
  loading,
  onMoveItem,
  savingItemIds,
}) {
  const [draggedItemId, setDraggedItemId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);

  const itemsByStatus = useMemo(() => {
    const columns = Object.fromEntries(WORK_STATUS_OPTIONS.map(([status]) => [status, []]));
    items.forEach((item) => columns[item.status]?.push(item));
    return columns;
  }, [items]);

  const startDragging = (event, item) => {
    if (loading || savingItemIds.has(item.id) || item.permissions?.statuses.length < 2) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(item.id));
    setDraggedItemId(item.id);
  };

  const dropIntoStatus = (event, status) => {
    event.preventDefault();
    const itemId = Number(event.dataTransfer.getData("text/plain"));
    const item = items.find((candidate) => candidate.id === itemId);
    setDraggedItemId(null);
    setDragOverStatus(null);
    if (item && itemId === draggedItemId && item.permissions?.statuses.includes(status)) {
      onMoveItem(item, status);
    }
  };

  return (
    <div className={`-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain px-4 pb-3 transition-opacity sm:-mx-6 sm:px-6 shell:-mx-0 shell:snap-none shell:overscroll-auto shell:px-0 ${loading ? "opacity-70" : "opacity-100"}`}>
      <div className="grid min-w-max auto-cols-[minmax(280px,calc(100vw_-_5.5rem))] grid-flow-col items-start gap-4 shell:auto-cols-[minmax(280px,82vw)] xl:min-w-0 xl:grid-cols-4 xl:grid-flow-row xl:auto-cols-auto">
        {WORK_STATUS_OPTIONS.map(([status, label]) => {
          const columnItems = itemsByStatus[status];
          const draggedItem = items.find((item) => item.id === draggedItemId);
          const canDrop = !loading && draggedItem?.status !== status && draggedItem?.permissions?.statuses.includes(status);
          const isDropTarget = dragOverStatus === status;
          return (
            <section
              key={status}
              aria-label={`${label} work items`}
              onDragOver={(event) => {
                if (!canDrop) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverStatus(status);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDragOverStatus(null);
              }}
              onDrop={(event) => dropIntoStatus(event, status)}
              className={`snap-start overflow-hidden rounded-ds-lg border bg-canvas/50 transition-all ${
                isDropTarget
                  ? "border-brand bg-brand-soft/25 shadow-[0_0_0_3px_rgba(45,200,219,0.12)]"
                  : "border-line"
              }`}
            >
              <div className="border-b border-line bg-surface px-4 pb-3 pt-3.5">
                <div className="mb-3 h-1 w-8 rounded-ds-pill">
                  <span className={`block h-full w-full rounded-ds-pill ${STATUS_ACCENTS[status]}`} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[12.5px] font-extrabold tracking-[0.01em] text-ink">{label}</h2>
                  <Badge variant={STATUS_VARIANTS[status]}>{columnItems.length}</Badge>
                </div>
              </div>

              <div className="min-h-[180px] space-y-3 p-3">
                {columnItems.length === 0 ? (
                  <div className={`grid min-h-[150px] place-items-center rounded-ds-md border border-dashed px-5 text-center transition-colors ${
                    isDropTarget ? "border-brand/60 bg-brand-soft/30" : "border-line bg-surface/45"
                  }`}>
                    <div>
                      <p className="text-[11.5px] font-bold text-copy">
                        {canDrop ? `Move to ${label}` : "No work items"}
                      </p>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                        {hasActiveFilters ? "No items match the current filters." : "Items in this status will appear here."}
                      </p>
                    </div>
                  </div>
                ) : columnItems.map((item) => {
                  const isSaving = savingItemIds.has(item.id);
                  const isBeingDragged = draggedItemId === item.id;
                  const canMove = item.permissions?.statuses.length > 1;
                  return (
                    <article
                      key={item.id}
                      draggable={!isSaving && !loading && canMove}
                      onDragStart={(event) => startDragging(event, item)}
                      onDragEnd={() => {
                        setDraggedItemId(null);
                        setDragOverStatus(null);
                      }}
                      className={`group overflow-hidden rounded-ds-md border bg-surface shadow-panel transition-all ${
                        isSaving
                          ? "border-brand/35 ring-2 ring-brand/10"
                          : "border-line hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-overlay"
                      } ${isBeingDragged ? "opacity-45" : "opacity-100"}`}
                    >
                      <WorkItemLink
                        item={item}
                        draggable={false}
                        className="block cursor-grab p-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand/25 active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-mono text-[10px] font-bold tracking-[0.04em] text-muted">{item.reference}</span>
                          <GripVertical className="h-4 w-4 shrink-0 text-muted/60 transition-colors group-hover:text-muted" aria-hidden="true" />
                        </div>
                        <h3 className="mt-2 text-[13px] font-extrabold leading-snug text-ink transition-colors group-hover:text-brand-strong">
                          {item.title}
                        </h3>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/70 pt-3">
                          <span className="min-w-0 truncate text-[10.5px] font-semibold text-copy">
                            {item.owner_detail?.display_name || "Unassigned"}
                          </span>
                          <Badge variant={PRIORITY_VARIANTS[item.priority]} className="shrink-0 capitalize">{item.priority}</Badge>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-3 text-[10.5px] text-muted">
                          <DueDate item={item} prefix="Due " empty="No due date" />
                          {isSaving && (
                            <span className="inline-flex items-center gap-1 font-bold text-brand-strong dark:text-brand">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                            </span>
                          )}
                        </div>
                      </WorkItemLink>
                      <div className="border-t border-line/70 p-2.5">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.07em] text-muted">
                          Move
                          <Select
                            aria-label={`Move ${item.reference}`}
                            value={item.status}
                            disabled={isSaving || loading || !canMove}
                            onChange={(event) => onMoveItem(item, event.target.value)}
                            className="min-h-[34px] py-1.5 text-[11px] normal-case tracking-normal"
                          >
                            {WORK_STATUS_OPTIONS.filter(([value]) => item.permissions?.statuses.includes(value)).map(([value, statusLabel]) => (
                              <option key={value} value={value}>{statusLabel}</option>
                            ))}
                          </Select>
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
