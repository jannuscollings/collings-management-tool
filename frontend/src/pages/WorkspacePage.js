import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { DrawerLink, WorkItemLink, useWorkItemContext } from "../components/work/WorkItemDrawer";
import toast from "react-hot-toast";
import { CalendarDays, ChevronDown, LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from "lucide-react";

import { WORK_PRIORITY_OPTIONS, WORK_STATUS_OPTIONS, workApi } from "../api/work";
import PageContainer from "../components/layout/PageContainer";
import WorkspaceKanban from "../components/work/WorkspaceKanban";
import WorkspaceTimeline from "../components/work/WorkspaceTimeline";
import WorkspaceTableCell from "../components/work/WorkspaceTableCell";
import { sortWorkItems, TABLE_COLUMNS } from "./workspaceTable";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Field, Input, Select } from "../components/ui/Field";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";

const STATUS_LABELS = {
  new: "New",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

const collapsedBoardsKey = (workspaceSlug) => `cmt-collapsed-boards:${workspaceSlug}`;
function readCollapsedBoards(workspaceSlug) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(collapsedBoardsKey(workspaceSlug)) || "[]");
    return Array.isArray(saved) && saved.every((id) => typeof id === "string" && /^\d+$/.test(id)) ? saved : [];
  } catch {
    return [];
  }
}

function GroupHeading({ group, canRename, onRename }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const savingRef = useRef(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const cancel = () => {
    cancelRef.current = true;
    setName(group.name);
    setError("");
    setEditing(false);
  };

  const save = async () => {
    if (cancelRef.current || savingRef.current) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) {
      cancel();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await onRename(group, trimmed);
      setEditing(false);
    } catch (renameError) {
      setError(renameError.response?.data?.name?.[0] || renameError.response?.data?.detail || "Couldn't rename the board. Try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return <div className="min-w-0">
    <h2 className="text-[13px] font-extrabold tracking-[0.02em] text-ink">
      {editing ? <input
        ref={inputRef}
        aria-label={`Rename ${group.name}`}
        value={name}
        maxLength={120}
        disabled={saving}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); save(); }
          if (event.key === "Escape") { event.preventDefault(); cancel(); }
        }}
        onBlur={save}
        className="min-w-0 max-w-full rounded-ds-xs border border-brand bg-surface px-2 py-1 text-inherit outline-none focus:ring-2 focus:ring-brand/20"
      /> : <span
        onDoubleClick={canRename ? () => { cancelRef.current = false; setName(group.name); setEditing(true); } : undefined}
        title={canRename ? "Double-click to rename" : undefined}
        className={canRename ? "cursor-text rounded-ds-xs hover:text-brand-strong" : undefined}
      >{group.name}</span>}
    </h2>
    {saving && <span role="status" className="text-[10.5px] text-muted">Saving…</span>}
    {error && <span role="alert" className="text-[10.5px] text-danger">{error}</span>}
  </div>;
}

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
  const [savingCell, setSavingCell] = useState(null);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [boardCreating, setBoardCreating] = useState(false);
  const [boardError, setBoardError] = useState("");
  const pendingMoves = useRef(new Set());
  const fetchSequence = useRef(0);
  const [moveRevision, setMoveRevision] = useState(0);
  const workspaceSlugRef = useRef(workspaceSlug);
  workspaceSlugRef.current = workspaceSlug;

  useEffect(() => { setShowNewBoard(false); setNewBoardName(""); setBoardError(""); }, [workspaceSlug]);

  const viewMode = ["kanban", "timeline"].includes(searchParams.get("view")) ? searchParams.get("view") : "table";
  const querySearch = searchParams.get("q") || "";
  const boardFocus = searchParams.get("board");
  const statusFilter = searchParams.get("status") || "";
  const priorityFilter = searchParams.get("priority") || "";
  const ownerFilter = searchParams.get("owner") || "";
  const sortColumn = TABLE_COLUMNS.some(([key]) => key === searchParams.get("sort")) ? searchParams.get("sort") : null;
  const sortDirection = ["asc", "desc"].includes(searchParams.get("direction")) ? searchParams.get("direction") : null;
  const [searchInput, setSearchInput] = useState(querySearch);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [collapsePreference, setCollapsePreference] = useState(() => ({ workspaceSlug, ids: readCollapsedBoards(workspaceSlug) }));
  const collapsedBoards = collapsePreference.workspaceSlug === workspaceSlug
    ? collapsePreference.ids : readCollapsedBoards(workspaceSlug);
  const toggleBoard = (boardId) => {
    const id = String(boardId);
    const next = collapsedBoards.includes(id) ? collapsedBoards.filter((saved) => saved !== id) : [...collapsedBoards, id];
    setCollapsePreference({ workspaceSlug, ids: next });
    try { window.localStorage.setItem(collapsedBoardsKey(workspaceSlug), JSON.stringify(next)); } catch {
      // Collapse still works for this session when local storage is unavailable.
    }
  };
  const currentQuery = useRef("");
  currentQuery.current = JSON.stringify([workspaceSlug, querySearch, statusFilter, priorityFilter, ownerFilter]);
  const hasActiveFilters = Boolean(querySearch || statusFilter || priorityFilter || ownerFilter);
  const advancedFilterCount = [statusFilter, priorityFilter, ownerFilter].filter(Boolean).length;

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
  const tableGroups = useMemo(() => filteredGroups.map((group) => ({
    ...group,
    work_items: sortWorkItems(group.work_items, sortColumn, sortDirection),
  })), [filteredGroups, sortColumn, sortDirection]);

  useEffect(() => {
    if (!workspace || !boardFocus || viewMode !== "table") return undefined;
    const target = document.getElementById(`board-${boardFocus}`);
    if (!target) return undefined;
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [workspace, boardFocus, viewMode]);

  const changeSort = (column) => {
    const next = new URLSearchParams(searchParams);
    if (sortColumn !== column || !sortDirection) {
      next.set("sort", column);
      next.set("direction", "asc");
    } else if (sortDirection === "asc") {
      next.set("direction", "desc");
    } else {
      next.delete("sort");
      next.delete("direction");
    }
    setSearchParams(next);
  };

  const updateFilter = (key) => (event) => {
    const next = new URLSearchParams(searchParams);
    if (event.target.value) next.set(key, event.target.value);
    else next.delete(key);
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchInput("");
    const next = new URLSearchParams(searchParams);
    ["q", "status", "priority", "owner"].forEach((key) => next.delete(key));
    setSearchParams(next);
  };

  const changeView = (nextView) => {
    const next = new URLSearchParams(searchParams);
    if (nextView !== "table") next.set("view", nextView);
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
      toast.error(error.response?.data?.reviewer?.[0] || error.response?.data?.status?.[0] || error.response?.data?.detail || `Couldn't move ${item.reference}`);
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

  const saveCell = async (item, field, value) => {
    if (!isAdmin || !item.permissions?.manage || itemsLoading || pendingMoves.current.has(item.id)) return;
    const queryAtStart = currentQuery.current;
    pendingMoves.current.add(item.id);
    fetchSequence.current += 1;
    setSavingCell(`${item.id}:${field}`);
    try {
      const { data } = await workApi.updateItem(item.id, { [field]: value });
      setWorkItems((current) => {
        if (currentQuery.current !== queryAtStart) return current;
        if ((statusFilter && data.status !== statusFilter)
            || (priorityFilter && data.priority !== priorityFilter)
            || (ownerFilter && String(data.owner || "") !== ownerFilter)) {
          return current.filter((candidate) => candidate.id !== item.id);
        }
        return current.map((candidate) => candidate.id === item.id ? data : candidate);
      });
    } catch (error) {
      const details = error.response?.data;
      toast.error(details?.[field]?.[0] || details?.reviewer?.[0] || details?.detail || `Couldn't update ${field.replace('_', ' ')} for ${item.reference}`);
    } finally {
      pendingMoves.current.delete(item.id);
      setSavingCell(null);
    }
  };

  const renameGroup = async (group, name) => {
    if (!isAdmin) return;
    const { data } = await workApi.renameBoard(workspaceSlug, group.id, name);
    setWorkspace((current) => ({ ...current, groups: current.groups.map((candidate) => ({
      ...candidate,
      name: data.find((board) => board.id === candidate.id)?.name ?? candidate.name,
    })) }));
  };

  const createBoard = async (event) => {
    event.preventDefault();
    if (!isAdmin || boardCreating) return;
    const name = newBoardName.trim();
    if (!name) { setBoardError("Enter a board name."); return; }
    setBoardCreating(true);
    setBoardError("");
    try {
      const { data } = await workApi.addBoard(workspaceSlug, name);
      if (workspaceSlugRef.current === workspaceSlug) {
        setWorkspace((current) => ({ ...current, groups: data.map((board) =>
          current.groups.find((group) => group.id === board.id) || { ...board, work_items: [] }
        ) }));
        setNewBoardName("");
        setShowNewBoard(false);
      }
      toast.success("Board added");
    } catch (error) {
      setBoardError(error.response?.data?.name?.[0] || error.response?.data?.detail || "Couldn't add the board.");
    } finally { setBoardCreating(false); }
  };

  if (loading) return <PageContainer className="text-sm text-muted">Loading workspace…</PageContainer>;
  if (!workspace) return <PageContainer className="text-sm text-copy">Workspace unavailable.</PageContainer>;

  return (
    <PageContainer className="pb-16 shell:pb-[34px]">
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
              <button
                type="button"
                aria-pressed={viewMode === "timeline"}
                onClick={() => changeView("timeline")}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-ds-xs px-3 text-[11.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${
                  viewMode === "timeline" ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-canvas hover:text-copy"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Timeline
              </button>
            </div>
            {isAdmin && <Button variant="secondary" disabled={boardCreating} aria-expanded={showNewBoard} aria-controls="new-board-form"
              onClick={() => { setShowNewBoard((open) => !open); setNewBoardName(""); setBoardError(""); }}>
              <Plus className="h-4 w-4" /> New Board
            </Button>}
            {isAdmin && <Button asChild>
              <DrawerLink drawer="new-work-item" drawerParams={{ drawerWorkspace: workspaceSlug }}>
                <Plus className="h-4 w-4" /> New work item
              </DrawerLink>
            </Button>}
          </>
        }
      />

      {isAdmin && showNewBoard && <Panel id="new-board-form" className="mb-5 p-4">
        <form onSubmit={createBoard} className="flex flex-wrap items-end gap-3">
          <Field label="Board name" className="min-w-[180px] flex-1">
            <Input autoFocus required maxLength={120} value={newBoardName}
              onChange={(event) => { setNewBoardName(event.target.value); setBoardError(""); }} />
          </Field>
          <Button type="submit" disabled={boardCreating || !newBoardName.trim()}>{boardCreating ? "Creating…" : "Create Board"}</Button>
          <Button variant="secondary" disabled={boardCreating} onClick={() => { setShowNewBoard(false); setNewBoardName(""); setBoardError(""); }}>Cancel</Button>
        </form>
        {boardError && <p role="alert" className="mt-2 text-xs text-critical">{boardError}</p>}
      </Panel>}

      <Panel className="mb-5 p-3 shell:p-4">
        <div className="grid gap-2 shell:grid-cols-[minmax(230px,2fr)_repeat(3,minmax(140px,1fr))_auto] shell:items-end shell:gap-3">
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
          <button type="button" aria-expanded={mobileFiltersOpen} aria-controls="workspace-mobile-filters" onClick={() => setMobileFiltersOpen((value) => !value)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-ds-xs border border-line bg-surface px-3 text-xs font-bold text-copy focus-visible:ring-2 focus-visible:ring-brand shell:hidden">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{advancedFilterCount > 0 && <span className="rounded-ds-pill bg-brand-soft px-2 py-0.5 text-brand-strong">{advancedFilterCount}</span>}
          </button>
          <div id="workspace-mobile-filters" className={`${mobileFiltersOpen ? "grid" : "hidden"} grid-cols-2 gap-2 shell:contents`}>
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
            <Field label="Owner" className="col-span-2 shell:col-span-1">
            <Select value={ownerFilter} onChange={updateFilter("owner")}>
              <option value="">All owners</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
            </Select>
            </Field>
            <Button variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters} className="col-span-2 min-h-11 shell:col-span-1 shell:min-h-[38px] shell:self-end">
              <X className="h-4 w-4" /> Clear
            </Button>
          </div>
        </div>
        {itemsLoading && <p className="mt-2 text-[10.5px] text-muted">Updating work items…</p>}
      </Panel>

      {viewMode === "table" && <div className={`space-y-5 transition-opacity ${itemsLoading ? "opacity-70" : "opacity-100"}`}>
        {tableGroups.map((group) => {
          const filterMatch = hasActiveFilters && group.work_items.length > 0;
          const expanded = !collapsedBoards.includes(String(group.id)) || filterMatch;
          return (
          <section key={group.id} id={`board-${group.id}`} tabIndex={-1} className="scroll-mt-20 focus:outline-none">
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/55 px-4 py-3">
                <GroupHeading group={group} canRename={isAdmin} onRename={renameGroup} />
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="neutral">{group.work_items.length} {group.work_items.length === 1 ? "item" : "items"}</Badge>
                  <button type="button" aria-expanded={expanded} aria-controls={`board-content-${group.id}`} aria-label={filterMatch ? `${group.name} expanded to show matching work` : `${expanded ? "Collapse" : "Expand"} ${group.name}`} onClick={() => toggleBoard(group.id)} disabled={filterMatch}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-ds-xs text-muted hover:bg-surface/70 hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-default disabled:opacity-60 shell:h-8 shell:w-8">
                    <ChevronDown className={`h-4 w-4 transition-transform duration-150 motion-reduce:transition-none ${expanded ? "" : "-rotate-90"}`} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {expanded ? <div id={`board-content-${group.id}`}>
              <div className="hidden overflow-x-auto shell:block">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="bg-canvas/35">
                    <tr className="border-b border-line">
                      {TABLE_COLUMNS.map(([column, heading]) => (
                        <th key={column} scope="col" aria-sort={sortColumn === column && sortDirection ? (sortDirection === "asc" ? "ascending" : "descending") : "none"} className="px-[13px] py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-muted">
                          <button type="button" onClick={() => changeSort(column)} className="inline-flex items-center gap-1 rounded-ds-xs text-left uppercase hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30">{heading}{sortColumn === column && sortDirection && <span aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>}</button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {group.work_items.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-6 text-center text-xs text-muted">
                          {hasActiveFilters ? "No work items match the current filters." : "No work items in this board."}
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
                        {["status", "priority", "owner", "reviewer", "due_date"].map((field) => <td key={field} className="relative px-[13px] py-3"><WorkspaceTableCell item={item} field={field} users={users} canEdit={isAdmin && item.permissions?.manage && !itemsLoading && !pendingMoves.current.has(item.id)} busy={savingCell === `${item.id}:${field}`} onSave={saveCell} inTable /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div role="list" className="divide-y divide-line/70 shell:hidden" aria-label={`${group.name} mobile work items`}>
                {group.work_items.length === 0 ? <p className="px-4 py-6 text-center text-xs text-muted">
                  {hasActiveFilters ? "No work items match the current filters." : "No work items in this board."}
                </p> : group.work_items.map((item) => {
                  const canEdit = isAdmin && item.permissions?.manage && !itemsLoading && !pendingMoves.current.has(item.id);
                  const mobileField = (field, label, className = "") => <div key={field} className={`min-w-0 ${className}`}>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</dt>
                    <dd className="mt-1 break-words text-xs text-copy"><WorkspaceTableCell item={item} field={field} users={users} canEdit={canEdit} busy={savingCell === `${item.id}:${field}`} onSave={saveCell} /></dd>
                  </div>;
                  return <article role="listitem" key={item.id} className="px-4 py-3.5">
                    <WorkItemLink item={item} className="block min-h-11 rounded-ds-xs focus-visible:ring-2 focus-visible:ring-brand">
                      <span className="block break-words text-sm font-extrabold text-ink">{item.title}</span>
                      <span className="mt-1 block font-mono text-[10.5px] font-semibold text-muted">{item.reference}</span>
                    </WorkItemLink>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
                      {mobileField("status", "Status")}
                      {mobileField("priority", "Priority")}
                      {mobileField("owner", "Owner")}
                      {mobileField("due_date", "Due")}
                      {mobileField("reviewer", "Reviewer", "col-span-2 border-t border-line/70 pt-2")}
                    </dl>
                  </article>;
                })}
              </div>
              </div> : <div id={`board-content-${group.id}`} hidden />}
            </Panel>
          </section>
        ); })}
      </div>}
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
      {viewMode === "timeline" && <WorkspaceTimeline groups={filteredGroups} hasActiveFilters={hasActiveFilters} loading={itemsLoading} collapsedBoards={collapsedBoards} onToggleBoard={toggleBoard} />}
    </PageContainer>
  );
}
