import { useState } from "react";
import { WorkItemLink } from "./WorkItemDrawer";
import { formatDay, itemPlacement, localToday, timelineStart } from "./workspaceTimelineDates";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import Panel from "../ui/Panel";

const DAYS = 42;
const DAY_WIDTH = 32;
const STATUS_LABELS = { new: "New", in_progress: "In progress", review: "Review", done: "Done" };

function ItemLabel({ item }) {
  return <div className={`min-w-0 ${item.status === "done" ? "opacity-55" : ""}`}>
    <WorkItemLink item={item} className="block truncate text-[11.5px] font-bold text-ink hover:text-brand-strong" title={item.title}>{item.title}</WorkItemLink>
    <div className="truncate font-mono text-[10px] text-muted">{item.reference} · {STATUS_LABELS[item.status] || item.status}</div>
  </div>;
}

function DateGrid({ start, today, item, placement }) {
  const isTodayVisible = today >= start && today < start + DAYS;
  return <div className="relative h-12 shrink-0" style={{ width: DAYS * DAY_WIDTH, backgroundImage: "repeating-linear-gradient(to right, transparent 0, transparent 31px, var(--timeline-line, #e5e7eb) 31px, var(--timeline-line, #e5e7eb) 32px)" }}>
    {isTodayVisible && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 border-x border-brand/60 bg-brand-soft/45" style={{ left: (today - start) * DAY_WIDTH, width: DAY_WIDTH }} />}
    <WorkItemLink item={item}
      aria-label={`${item.reference} ${item.title}, ${placement.dueOnly ? `due ${item.due_date}` : `${item.start_date} to ${item.due_date}`}`}
      title={placement.dueOnly ? `Due ${item.due_date} · ${item.title}` : `${item.start_date} – ${item.due_date} · ${item.title}`}
      className={`absolute top-3 z-10 flex h-6 items-center overflow-hidden rounded-ds-xs px-1.5 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${placement.dueOnly ? "border-2 border-brand-strong bg-surface text-brand-strong" : "bg-brand-strong text-white"} ${item.status === "done" ? "opacity-45" : ""}`}
      style={{ left: placement.first * DAY_WIDTH + (placement.dueOnly ? 4 : 1), width: placement.dueOnly ? DAY_WIDTH - 8 : placement.span * DAY_WIDTH - 2 }}
    >{placement.dueOnly ? "◆" : placement.span > 2 ? item.title : ""}</WorkItemLink>
  </div>;
}

export default function WorkspaceTimeline({ groups, hasActiveFilters, loading }) {
  const [windowOffset, setWindowOffset] = useState(0);
  const today = localToday();
  const start = timelineStart(today, windowOffset);
  const days = Array.from({ length: DAYS }, (_, index) => start + index);
  const end = start + DAYS - 1;

  return <div className={`space-y-5 transition-opacity ${loading ? "opacity-70" : "opacity-100"}`} aria-label="Workspace Timeline">
    <Panel className="flex flex-wrap items-center justify-between gap-3 p-3 shell:px-4">
      <div>
        <h2 className="text-[13px] font-extrabold text-ink">Timeline</h2>
        <p className="mt-0.5 text-[11px] text-muted">{formatDay(start, { month: "short", day: "numeric", year: "numeric" })} – {formatDay(end, { month: "short", day: "numeric", year: "numeric" })} · 6 weeks</p>
      </div>
      <div className="flex items-center gap-1.5" aria-label="Timeline navigation">
        <Button variant="secondary" onClick={() => setWindowOffset((value) => value - 1)} className="px-3">Previous</Button>
        <Button variant="secondary" onClick={() => setWindowOffset(0)} className="px-3">Today</Button>
        <Button variant="secondary" onClick={() => setWindowOffset((value) => value + 1)} className="px-3">Next</Button>
      </div>
    </Panel>
    {groups.map((group) => {
      const rows = group.work_items.map((item) => ({ item, placement: itemPlacement(item, start, DAYS) }));
      const scheduled = rows.filter(({ placement }) => typeof placement === "object");
      const unscheduled = rows.filter(({ placement }) => placement === "unscheduled");
      const outside = rows.filter(({ placement }) => placement === "outside");
      return <section key={group.id} aria-label={`${group.name} Timeline`}>
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/55 px-4 py-3">
            <h3 className="text-[13px] font-extrabold tracking-[0.02em] text-ink">{group.name}</h3>
            <Badge variant="neutral">{group.work_items.length} {group.work_items.length === 1 ? "item" : "items"}</Badge>
          </div>
          <div className="overflow-x-auto" aria-label={`${group.name} date grid`}>
            <div style={{ minWidth: 220 + DAYS * DAY_WIDTH }}>
              <div className="flex border-b border-line bg-canvas/35">
                <div className="sticky left-0 z-20 w-[220px] shrink-0 bg-canvas px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-muted">Work item</div>
                <div className="flex" aria-label="Dates">
                  {days.map((day) => <div key={day} className={`flex w-8 shrink-0 flex-col items-center border-l border-line/70 py-1 text-[9px] leading-4 ${day === today ? "bg-brand-soft font-extrabold text-brand-strong" : "text-muted"}`} aria-label={formatDay(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}>
                    <span>{formatDay(day, { weekday: "short" }).slice(0, 1)}</span><span>{formatDay(day, { day: "numeric" })}</span>
                  </div>)}
                </div>
              </div>
              {scheduled.length ? scheduled.map(({ item, placement }) => <div key={item.id} className="flex border-b border-line/70 last:border-b-0 hover:bg-brand-soft/25">
                <div className="sticky left-0 z-20 flex w-[220px] shrink-0 items-center border-r border-line/70 bg-surface px-3 py-1"><ItemLabel item={item} /></div>
                <DateGrid start={start} today={today} item={item} placement={placement} />
              </div>) : <p className="px-4 py-5 text-xs text-muted">{group.work_items.length === 0 ? (hasActiveFilters ? "No work items match the current filters." : "No work items in this board.") : "No dates in this window."}</p>}
            </div>
          </div>
          {unscheduled.length > 0 && <div className="border-t border-line px-4 py-3">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Unscheduled</h4>
            <div className="mt-2 flex flex-wrap gap-2">{unscheduled.map(({ item }) => <WorkItemLink key={item.id} item={item} className={`rounded-ds-xs border border-line bg-canvas px-2.5 py-1.5 text-[11px] font-semibold text-copy hover:border-brand hover:text-brand-strong ${item.status === "done" ? "opacity-55" : ""}`}>{item.reference} · {item.title}</WorkItemLink>)}</div>
          </div>}
          {outside.length > 0 && <div className="border-t border-line px-4 py-3">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Outside this window</h4>
            <div className="mt-2 flex flex-wrap gap-2">{outside.map(({ item }) => <WorkItemLink key={item.id} item={item} className={`rounded-ds-xs border border-line bg-canvas px-2.5 py-1.5 text-[11px] font-semibold text-copy hover:border-brand hover:text-brand-strong ${item.status === "done" ? "opacity-55" : ""}`}>{item.reference} · {item.title} · {item.due_date}</WorkItemLink>)}</div>
          </div>}
        </Panel>
      </section>;
    })}
  </div>;
}
