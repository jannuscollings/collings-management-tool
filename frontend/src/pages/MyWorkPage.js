import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { WorkItemLink, useWorkItemContext } from "../components/work/WorkItemDrawer";
import toast from "react-hot-toast";
import { Search, X } from "lucide-react";

import { WORK_PRIORITY_OPTIONS, WORK_STATUS_OPTIONS, workApi } from "../api/work";
import PageContainer from "../components/layout/PageContainer";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Field, Input, Select } from "../components/ui/Field";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import DueDate from "../components/work/DueDate";
import ProfileAvatar from "../components/profile/ProfileAvatar";

const PRIORITY_VARIANTS = {
  low: "neutral",
  medium: "neutral",
  high: "warning",
};

const STATUS_LABELS = {
  new: "New",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

const STATUS_VARIANTS = {
  new: "neutral",
  in_progress: "info",
  review: "review",
  done: "success",
};

function Relevance({ item, userId }) {
  const isOwner = item.owner === userId;
  const isReviewer = item.reviewer === userId;
  return <div className="flex flex-wrap gap-1.5">
    {isOwner && <Badge variant="info">Owner</Badge>}
    {isReviewer && <Badge variant="review">{item.status === "review" ? "Waiting for my review" : "Reviewer"}</Badge>}
    {!isOwner && !isReviewer && <Badge variant="neutral">Sub-work</Badge>}
  </div>;
}

export default function MyWorkPage() {
  const { revision } = useWorkItemContext();
  const user = useSelector((state) => state.auth.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const querySearch = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "";
  const priorityFilter = searchParams.get("priority") || "";
  const dueFilter = searchParams.get("due") || "";
  const [searchInput, setSearchInput] = useState(querySearch);
  const hasActiveFilters = Boolean(querySearch || statusFilter || priorityFilter || dueFilter);
  const secondaryFilterCount = Number(Boolean(statusFilter)) + Number(Boolean(priorityFilter)) + Number(Boolean(dueFilter));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    workApi.listWorkItems({
      relevance: "mine",
      ...(querySearch && { q: querySearch }),
      ...(statusFilter && { status: statusFilter }),
      ...(priorityFilter && { priority: priorityFilter }),
      ...(dueFilter && { due: dueFilter, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    })
      .then(({ data }) => {
        if (active) setWorkItems(data);
      })
      .catch(() => {
        if (!active) return;
        setWorkItems([]);
        setLoadError(true);
        toast.error("Couldn't load your work items");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [querySearch, statusFilter, priorityFilter, dueFilter, revision]);

  useEffect(() => {
    setSearchInput(querySearch);
  }, [querySearch]);

  useEffect(() => {
    const normalizedSearch = searchInput.trim();
    if (normalizedSearch === querySearch) return undefined;
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (normalizedSearch) next.set("q", normalizedSearch);
      else next.delete("q");
      setSearchParams(next);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [querySearch, searchInput, searchParams, setSearchParams]);

  const updateFilter = (key) => (event) => {
    const next = new URLSearchParams(searchParams);
    if (event.target.value) next.set(key, event.target.value);
    else next.delete(key);
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchParams({});
  };

  return (
    <PageContainer className="pb-16 shell:pb-[34px]">
      <PageHeader
        eyebrow="Work"
        title="My Work"
        description="Work items you own, review or have assigned sub-work on across workspaces."
        actions={user && <div className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-copy"><ProfileAvatar user={user} className="h-7 w-7 text-[10px]" /><span className="max-w-40 truncate">{user.display_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}</span></div>}
      />

      <Panel className="mb-5 p-4">
        <div className="grid gap-3 shell:grid-cols-[minmax(260px,2fr)_repeat(3,minmax(140px,1fr))_auto] shell:items-end">
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Reference, title or brief"
                className="pl-9"
              />
            </div>
          </Field>
          <Button variant="secondary" className="min-h-11 justify-self-start shell:hidden" aria-expanded={mobileFiltersOpen} aria-controls="my-work-mobile-filters" onClick={() => setMobileFiltersOpen((open) => !open)}>
            Filters{secondaryFilterCount ? ` (${secondaryFilterCount})` : ""}
          </Button>
          <div id="my-work-mobile-filters" className={`${mobileFiltersOpen ? "grid" : "hidden"} grid-cols-2 gap-2 shell:contents`}>
          <Field label="Status">
            <Select value={statusFilter} onChange={updateFilter("status")}>
              <option value="">All statuses</option>
              {WORK_STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priorityFilter} onChange={updateFilter("priority")}>
              <option value="">All priorities</option>
              {WORK_PRIORITY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Due">
            <Select value={dueFilter} onChange={updateFilter("due")}>
              <option value="">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="soon">Due soon</option>
            </Select>
          </Field>
          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="col-span-2 min-h-11 justify-self-start shell:col-auto shell:min-h-[38px] shell:self-end"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
          </div>
        </div>
        {loading && <p className="mt-2 text-[10.5px] text-muted">Updating work items…</p>}
      </Panel>

      <Panel className={`overflow-hidden transition-opacity ${loading ? "opacity-70" : "opacity-100"}`}>
        <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/55 px-4 py-3">
          <h2 className="text-[13px] font-extrabold tracking-[0.02em] text-ink">Relevant work items</h2>
          <Badge variant="neutral">{workItems.length} {workItems.length === 1 ? "item" : "items"}</Badge>
        </div>
        <div className="hidden overflow-x-auto shell:block">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-canvas/35">
              <tr className="border-b border-line">
                {[
                  "Reference",
                  "Work item",
                  "Workspace / group",
                  "Relevance",
                  "Status",
                  "Priority",
                  "Due date",
                ].map((heading) => (
                  <th key={heading} className="px-[13px] py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-muted">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {!loading && workItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-xs text-muted">
                    {loadError
                      ? "Your work items couldn't be loaded."
                      : hasActiveFilters
                        ? "No work items match the current filters."
                        : "No work items are currently assigned to you for ownership, review or sub-work."}
                  </td>
                </tr>
              ) : workItems.map((item) => {
                return (
                  <tr key={item.id} className="text-[11.5px] text-copy transition-colors hover:bg-brand-soft/35">
                    <td className="px-[13px] py-3 font-mono text-[10.5px] font-semibold text-muted">
                      <WorkItemLink item={item} className="hover:text-brand-strong">{item.reference}</WorkItemLink>
                    </td>
                    <td className="px-[13px] py-3">
                      <WorkItemLink item={item} className="font-bold text-ink hover:text-brand-strong">{item.title}</WorkItemLink>
                    </td>
                    <td className="px-[13px] py-3">
                      <span className="font-semibold text-copy">{item.workspace_name}</span>
                      <span className="mt-0.5 block text-[10.5px] text-muted">{item.group_name}</span>
                    </td>
                    <td className="px-[13px] py-3">
                      <Relevance item={item} userId={user?.id} />
                    </td>
                    <td className="px-[13px] py-3">
                      <Badge variant={STATUS_VARIANTS[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                    </td>
                    <td className="px-[13px] py-3">
                      <Badge variant={PRIORITY_VARIANTS[item.priority]} className="capitalize">{item.priority}</Badge>
                    </td>
                    <td className="px-[13px] py-3"><DueDate item={item} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-line/70 shell:hidden" aria-label="My Work mobile items">
          {!loading && workItems.length === 0 ? <p className="px-4 py-8 text-center text-xs text-muted">
            {loadError ? "Your work items couldn't be loaded." : hasActiveFilters ? "No work items match the current filters." : "No work items are currently assigned to you for ownership, review or sub-work."}
          </p> : workItems.map((item) => <article key={item.id} className="min-w-0 space-y-2 px-4 py-3 text-xs text-copy">
            <WorkItemLink item={item} className="block min-h-11 min-w-0 text-ink">
              <span className="block break-all font-mono text-[10px] font-semibold text-muted">{item.reference}</span>
              <span className="block break-all font-bold">{item.title}</span>
            </WorkItemLink>
            <p className="break-all text-muted">{item.workspace_name} / {item.group_name}</p>
            <div className="flex flex-wrap items-center gap-2"><Relevance item={item} userId={user?.id} />
              <Badge variant={STATUS_VARIANTS[item.status]}>{STATUS_LABELS[item.status]}</Badge>
              <Badge variant={PRIORITY_VARIANTS[item.priority]} className="capitalize">{item.priority}</Badge>
              <span className="text-muted"><DueDate item={item} prefix="Due " empty="Due —" /></span>
            </div>
          </article>)}
        </div>
      </Panel>
    </PageContainer>
  );
}
