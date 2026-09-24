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

export default function MyWorkPage() {
  const { revision } = useWorkItemContext();
  const user = useSelector((state) => state.auth.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const querySearch = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "";
  const priorityFilter = searchParams.get("priority") || "";
  const [searchInput, setSearchInput] = useState(querySearch);
  const hasActiveFilters = Boolean(querySearch || statusFilter || priorityFilter);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    workApi.listWorkItems({
      relevance: "mine",
      ...(querySearch && { q: querySearch }),
      ...(statusFilter && { status: statusFilter }),
      ...(priorityFilter && { priority: priorityFilter }),
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
  }, [querySearch, statusFilter, priorityFilter, revision]);

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
    <PageContainer>
      <PageHeader
        eyebrow="Work"
        title="My Work"
        description="Work items you own or are reviewing across workspaces."
      />

      <Panel className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 shell:grid-cols-[minmax(260px,2fr)_repeat(2,minmax(160px,1fr))_auto] shell:items-end">
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
          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="sm:self-end"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
        {loading && <p className="mt-2 text-[10.5px] text-muted">Updating work items…</p>}
      </Panel>

      <Panel className={`overflow-hidden transition-opacity ${loading ? "opacity-70" : "opacity-100"}`}>
        <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/55 px-4 py-3">
          <h2 className="text-[13px] font-extrabold tracking-[0.02em] text-ink">Relevant work items</h2>
          <Badge variant="neutral">{workItems.length} {workItems.length === 1 ? "item" : "items"}</Badge>
        </div>
        <div className="overflow-x-auto">
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
                        : "No work items are currently assigned to you for ownership or review."}
                  </td>
                </tr>
              ) : workItems.map((item) => {
                const isOwner = item.owner === user?.id;
                const isReviewer = item.reviewer === user?.id;
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
                      <div className="flex flex-wrap gap-1.5">
                        {isOwner && <Badge variant="info">Owner</Badge>}
                        {isReviewer && <Badge variant="review">Reviewer</Badge>}
                      </div>
                    </td>
                    <td className="px-[13px] py-3">
                      <Badge variant={STATUS_VARIANTS[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                    </td>
                    <td className="px-[13px] py-3">
                      <Badge variant={PRIORITY_VARIANTS[item.priority]} className="capitalize">{item.priority}</Badge>
                    </td>
                    <td className="px-[13px] py-3">{item.due_date || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageContainer>
  );
}
