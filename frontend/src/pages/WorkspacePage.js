import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { DrawerLink, WorkItemLink, useWorkItemContext } from "../components/work/WorkItemDrawer";
import toast from "react-hot-toast";
import { LayoutGrid, List, Plus, Search, X } from "lucide-react";

import { WORK_PRIORITY_OPTIONS, WORK_STATUS_OPTIONS, workApi } from "../api/work";
import PageContainer from "../components/layout/PageContainer";
import WorkspaceKanban from "../components/work/WorkspaceKanban";
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

export default function WorkspacePage() {
  const { revision } = useWorkItemContext();
  const isAdmin = useSelector((state) => state.auth.user?.is_staff);
  const { workspaceSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState(null);
  const [workItems, setWorkItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [savingItemIds, setSavingItemIds] = useState(() => new Set());
  const pendingMoves = useRef(new Set());
  const fetchSequence = useRef(0);
  const [moveRevision, setMoveRevision] = useState(0);

  const viewMode = searchParams.get("view") === "kanban" ? "kanban" : "table";
  const querySearch = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "";
  const priorityFilter = searchParams.get("priority") || "";
  const ownerFilter = searchParams.get("owner") || "";
  const [searchInput, setSearchInput] = useState(querySearch);
  const currentQuery = useRef("");
  currentQuery.current = JSON.stringify([workspaceSlug, querySearch, statusFilter, priorityFilter, ownerFilter]);
  const hasActiveFilters = Boolean(querySearch || statusFilter || priorityFilter || ownerFilter);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([workApi.getWorkspace(workspaceSlug), workApi.listUsers()])
      .then(([workspaceResponse, usersResponse]) => {
        if (!active) return;
        setWorkspace(workspaceResponse.data);
        setUsers(usersResponse.data);
      })
      .catch(() => {
        if (active) toast.error("Couldn't load the workspace");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    let active = true;
    setItemsLoading(true);
    const sequence = ++fetchSequence.current;
    workApi.listWorkItems({
      workspace: workspaceSlug,
      ...(querySearch && { q: querySearch }),
      ...(statusFilter && { status: statusFilter }),
      ...(priorityFilter && { priority: priorityFilter }),
      ...(ownerFilter && { owner: ownerFilter }),
    })
      .then(({ data }) => {
        if (active && sequence === fetchSequence.current) setWorkItems(data);
      })
      .catch(() => {
        if (active) toast.error("Couldn't filter the work items");
      })
      .finally(() => {
        if (active) setItemsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceSlug, querySearch, statusFilter, priorityFilter, ownerFilter, revision, moveRevision]);

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

  const filteredGroups = useMemo(() => {
    if (!workspace) return [];
    return workspace.groups.map((group) => ({
      ...group,
      work_items: workItems.filter((item) => item.group === group.id),
    }));
  }, [workspace, workItems]);

  const updateFilter = (key) => (event) => {
    const next = new URLSearchParams(searchParams);
    if (event.target.value) next.set(key, event.target.value);
    else next.delete(key);
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchParams(viewMode === "kanban" ? { view: "kanban" } : {});
  };

  const changeView = (nextView) => {
    const next = new URLSearchParams(searchParams);
    if (nextView === "kanban") next.set("view", "kanban");
    else next.delete("view");
    setSearchParams(next);
  };

  const moveItem = async (item, nextStatus) => {
    if (itemsLoading || item.status === nextStatus || pendingMoves.current.has(item.id) || !item.permissions?.statuses.includes(nextStatus)) return;
    const previousStatus = item.status;
    const queryAtStart = currentQuery.current;
    pendingMoves.current.add(item.id);
    fetchSequence.current += 1;
    setSavingItemIds((current) => new Set(current).add(item.id));
    setWorkItems((current) => current.map((candidate) => (
      candidate.id === item.id ? { ...candidate, status: nextStatus } : candidate
    )));

    try {
      const { data } = await workApi.updateItem(item.id, { status: nextStatus });
      setWorkItems((current) => {
        if (currentQuery.current !== queryAtStart) return current;
        if (statusFilter && data.status !== statusFilter) {
          return current.filter((candidate) => candidate.id !== item.id);
        }
        return current.map((candidate) => candidate.id === item.id ? data : candidate);
      });
      toast.success(`${item.reference} moved to ${STATUS_LABELS[data.status]}`);
    } catch (error) {
      setWorkItems((current) => currentQuery.current !== queryAtStart ? current : current.map((candidate) => (
        candidate.id === item.id ? { ...candidate, status: previousStatus } : candidate
      )));
      toast.error(error.response?.data?.status?.[0] || error.response?.data?.detail || `Couldn't move ${item.reference}`);
    } finally {
      pendingMoves.current.delete(item.id);
      setMoveRevision((value) => value + 1);
      setSavingItemIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  if (loading) return <PageContainer className="text-sm text-muted">Loading workspace…</PageContainer>;
  if (!workspace) return <PageContainer className="text-sm text-copy">Workspace unavailable.</PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Workspace"
        title={workspace.name}
        description="Internal work items grouped by delivery stream."
        actions={
          <>
            <div className="inline-flex rounded-ds-sm border border-line bg-surface p-1" role="group" aria-label="Workspace view">
              <button
                type="button"
                aria-pressed={viewMode === "table"}
                onClick={() => changeView("table")}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-ds-xs px-3 text-[11.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${
                  viewMode === "table" ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-canvas hover:text-copy"
                }`}
              >
                <List className="h-3.5 w-3.5" /> Table
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "kanban"}
                onClick={() => changeView("kanban")}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-ds-xs px-3 text-[11.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${
                  viewMode === "kanban" ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-canvas hover:text-copy"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
            </div>
            {isAdmin && <Button asChild>
              <DrawerLink drawer="new-work-item" drawerParams={{ drawerWorkspace: workspaceSlug }}>
                <Plus className="h-4 w-4" /> New work item
              </DrawerLink>
            </Button>}
          </>
        }
      />

      <Panel className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 shell:grid-cols-[minmax(230px,2fr)_repeat(3,minmax(140px,1fr))_auto] shell:items-end">
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
              {WORK_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priorityFilter} onChange={updateFilter("priority")}>
              <option value="">All priorities</option>
              {WORK_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Owner">
            <Select value={ownerFilter} onChange={updateFilter("owner")}>
              <option value="">All owners</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
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
        {itemsLoading && <p className="mt-2 text-[10.5px] text-muted">Updating work items…</p>}
      </Panel>

      <div className={`${viewMode === "kanban" ? "hidden" : ""} space-y-5 transition-opacity ${itemsLoading ? "opacity-70" : "opacity-100"}`}>
        {filteredGroups.map((group) => (
          <section key={group.id}>
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/55 px-4 py-3">
                <h2 className="text-[13px] font-extrabold tracking-[0.02em] text-ink">{group.name}</h2>
                <Badge variant="neutral">{group.work_items.length} {group.work_items.length === 1 ? "item" : "items"}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="bg-canvas/35">
                    <tr className="border-b border-line">
                      {["Reference", "Work item", "Status", "Priority", "Owner", "Reviewer", "Due date"].map((heading) => (
                        <th key={heading} className="px-[13px] py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-muted">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {group.work_items.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-6 text-center text-xs text-muted">
                          {hasActiveFilters ? "No work items match the current filters." : "No work items in this group."}
                        </td>
                      </tr>
                    ) : group.work_items.map((item) => (
                      <tr key={item.id} className="text-[11.5px] text-copy transition-colors hover:bg-brand-soft/35">
                        <td className="px-[13px] py-3 font-mono text-[10.5px] font-semibold text-muted">
                          <WorkItemLink item={item} className="hover:text-brand-strong">{item.reference}</WorkItemLink>
                        </td>
                        <td className="px-[13px] py-3">
                          <WorkItemLink item={item} className="font-bold text-ink hover:text-brand-strong">{item.title}</WorkItemLink>
                        </td>
                        <td className="px-[13px] py-3"><Badge variant={STATUS_VARIANTS[item.status]}>{STATUS_LABELS[item.status]}</Badge></td>
                        <td className="px-[13px] py-3"><Badge variant={PRIORITY_VARIANTS[item.priority]} className="capitalize">{item.priority}</Badge></td>
                        <td className="px-[13px] py-3">{item.owner_detail?.display_name || "Unassigned"}</td>
                        <td className="px-[13px] py-3">{item.reviewer_detail?.display_name || "Unassigned"}</td>
                        <td className="px-[13px] py-3">{item.due_date || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        ))}
      </div>
      {viewMode === "kanban" && (
        <WorkspaceKanban
          hasActiveFilters={hasActiveFilters}
          items={filteredGroups.flatMap((group) => group.work_items)}
          loading={itemsLoading}
          onMoveItem={moveItem}
          savingItemIds={savingItemIds}
          workspaceSlug={workspaceSlug}
        />
      )}
    </PageContainer>
  );
}
