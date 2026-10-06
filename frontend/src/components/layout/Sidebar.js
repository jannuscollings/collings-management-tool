import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import toast from "react-hot-toast";
import { Archive, Briefcase, ChevronLeft, ChevronRight, Inbox, Layers3, MoreHorizontal, Settings2, Ticket, UsersRound } from "lucide-react";

import { cn } from "../../lib/cn";
import { useSelector } from "react-redux";
import { workApi } from "../../api/work";
import { DrawerLink, useWorkItemContext } from "../work/WorkItemDrawer";

const groups = [
  {
    label: "Work",
    items: [
      { to: "/home", label: "Home", icon: Inbox },
      { to: "/my-work", label: "My Work", icon: Briefcase },
      { to: "/requests", label: "Requests", icon: Inbox },
    ],
  },
];

const navItemClass = (collapsed) => ({ isActive }) =>
  cn(
    "flex min-h-[42px] min-w-0 items-center gap-2.5 rounded-ds-sm border border-transparent px-3 text-[13px] font-semibold text-copy transition-colors hover:border-brand/20 hover:bg-brand-soft hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
    collapsed && "justify-center px-0",
    isActive && "border-brand/25 bg-brand-soft text-brand-strong"
  );

function WorkspaceRow({ workspace, collapsed, isAdmin, refreshWorkspaces }) {
  const [name, setName] = useState(workspace.name);
  const [draft, setDraft] = useState(workspace.name);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [archived, setArchived] = useState(false);
  const inputRef = useRef(null);
  const savingRef = useRef(false);
  const cancelRef = useRef(false);
  const renamingRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setName(workspace.name); setDraft(workspace.name); }, [workspace.name]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const cancel = () => {
    cancelRef.current = true;
    setDraft(name);
    setError("");
    setEditing(false);
  };
  const save = async (fromBlur = false) => {
    if (cancelRef.current || savingRef.current) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      if (fromBlur) cancel();
      else setError("Enter a workspace name.");
      return;
    }
    if (trimmed === name) { cancel(); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await workApi.updateWorkspace(workspace.slug, { name: trimmed });
      setName(trimmed);
      setDraft(trimmed);
      setEditing(false);
      refreshWorkspaces?.();
      toast.success("Workspace renamed");
    } catch (requestError) {
      setError(requestError.response?.data?.name?.[0] || "Couldn't rename the workspace.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const archive = async () => {
    if (!window.confirm(`Archive ${name}? Its work remains stored, but the workspace will leave normal navigation.`)) return;
    setSaving(true);
    try {
      await workApi.archiveWorkspace(workspace.slug);
      setArchived(true);
      refreshWorkspaces?.();
      toast.success("Workspace archived");
      const path = `/workspaces/${workspace.slug}`;
      if (location.pathname === path || location.pathname.startsWith(`${path}/`)) navigate("/home");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Couldn't update the workspace.");
    } finally { setSaving(false); }
  };

  if (archived) return null;
  if (collapsed || !isAdmin) return <NavLink to={`/workspaces/${workspace.slug}`} className={navItemClass(collapsed)} aria-label={collapsed ? name : undefined} title={collapsed ? name : undefined}>
    <Layers3 className="h-4 w-4 shrink-0" aria-hidden="true" />
    {!collapsed && <span className="truncate">{name}</span>}
  </NavLink>;

  return <div className="relative min-w-0">
    <div className="flex min-w-0 items-center gap-1">
      {editing ? <div className="flex min-h-[42px] min-w-0 flex-1 items-center gap-2 px-3">
        <Layers3 className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <input ref={inputRef} aria-label={`Rename ${name}`} value={draft} maxLength={120} disabled={saving}
          onChange={(event) => { setDraft(event.target.value); setError(""); }}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); save(); }
            if (event.key === "Escape") { event.preventDefault(); cancel(); }
          }}
          onBlur={() => save(true)}
          className="min-w-0 w-full rounded-ds-xs border border-brand bg-surface px-2 py-1 text-[13px] text-ink outline-none focus:ring-2 focus:ring-brand/20" />
      </div> : <NavLink to={`/workspaces/${workspace.slug}`} className={({ isActive }) => cn(navItemClass(false)({ isActive }), "min-w-0 flex-1")}>
        <Layers3 className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{name}</span>
      </NavLink>}
      {!editing && <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild><button type="button" disabled={saving} aria-label={`Actions for ${name}`} title={`Actions for ${name}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-ds-xs text-muted hover:bg-canvas hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button></DropdownMenu.Trigger>
        <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={4}
          onCloseAutoFocus={(event) => { if (renamingRef.current) { event.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); renamingRef.current = false; } }}
          className="z-[80] min-w-[176px] rounded-ds-sm border border-line bg-surface p-1 font-product text-copy shadow-overlay">
          <DropdownMenu.Item onSelect={() => { renamingRef.current = true; cancelRef.current = false; setDraft(name); setError(""); setEditing(true); }}
            className="cursor-pointer rounded-ds-xs px-3 py-2 text-xs font-semibold outline-none focus:bg-brand-soft focus:text-brand-strong">Rename workspace</DropdownMenu.Item>
          <DropdownMenu.Item asChild className="cursor-pointer rounded-ds-xs px-3 py-2 text-xs font-semibold outline-none focus:bg-brand-soft focus:text-brand-strong">
            <DrawerLink drawer="workspaces">Manage boards</DrawerLink>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={archive} className="cursor-pointer rounded-ds-xs px-3 py-2 text-xs font-semibold text-critical outline-none focus:bg-critical/5">Archive workspace</DropdownMenu.Item>
        </DropdownMenu.Content></DropdownMenu.Portal>
      </DropdownMenu.Root>}
    </div>
    {saving && <span role="status" className="px-3 text-[10px] text-muted">Saving…</span>}
    {error && <span role="alert" className="block px-3 text-[10px] text-critical">{error}</span>}
  </div>;
}

export default function Sidebar({ collapsed = false, onToggle }) {
  const user = useSelector((state) => state.auth.user);
  const { workspaces, workspaceLoadError, retryWorkspaces, refreshWorkspaces } = useWorkItemContext();
  const itemClass = navItemClass(collapsed);

  return (
    <aside className={cn("sticky top-0 hidden h-screen min-w-0 flex-col overflow-y-auto overflow-x-hidden border-r border-line bg-surface py-[18px] shell:flex", collapsed ? "px-3" : "px-4")}>
      <NavLink to="/home" aria-label={collapsed ? "Collings home" : undefined} title={collapsed ? "Collings home" : undefined} className={cn("flex min-h-[53px] items-center gap-3 border-b border-line/70 pb-[18px]", collapsed ? "justify-center" : "px-2.5")}>
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-brand text-sm font-extrabold text-white shadow-[0_4px_13px_rgba(45,200,219,0.26)]">C</span>
        {!collapsed && <span className="text-xl font-medium tracking-[0.2em] text-copy">COLLINGS</span>}
      </NavLink>
      <button type="button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn("mt-2 flex min-h-9 w-full items-center rounded-ds-sm text-muted transition-colors hover:bg-canvas hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand", collapsed ? "justify-center" : "justify-end px-2")}>
        {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
      </button>

      <nav className="mt-1 flex-1" aria-label="Primary navigation">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            {collapsed ? <div className="mb-2 border-t border-line/70" aria-hidden="true" /> :
              <p className="px-2.5 pb-1.5 pt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">{group.label}</p>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"} className={itemClass} aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mb-3">
          <div className={cn("flex items-center justify-between pb-1.5 pt-2", collapsed ? "flex-col gap-2 border-t border-line/70" : "px-2.5")}>
            {!collapsed && <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">Workspaces</p>}
            {user?.is_staff && (
              <DrawerLink drawer="workspaces" className="rounded-ds-xs p-1 text-muted hover:bg-canvas hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="Manage workspaces" title={collapsed ? "Manage workspaces" : undefined}>
                <Settings2 className="h-3.5 w-3.5" />
              </DrawerLink>
            )}
          </div>
          <div className="space-y-1">
            {workspaces.map((workspace) => <WorkspaceRow key={workspace.id} workspace={workspace} collapsed={collapsed} isAdmin={Boolean(user?.is_staff)} refreshWorkspaces={refreshWorkspaces} />)}
            {workspaceLoadError && <button type="button" onClick={retryWorkspaces} aria-label={collapsed ? "Reload workspaces" : undefined} title={collapsed ? "Reload workspaces" : undefined} className={cn("text-left text-xs font-semibold text-brand-strong", collapsed ? "flex min-h-[42px] w-full items-center justify-center" : "px-3 py-2")}>
              {collapsed ? <Layers3 className="h-4 w-4" aria-hidden="true" /> : "Reload workspaces"}
            </button>}
          </div>
        </div>
        {user?.is_staff && <NavLink to="/archive" className={itemClass} aria-label={collapsed ? "Archive" : undefined} title={collapsed ? "Archive" : undefined}>
          <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />{!collapsed && "Archive"}
        </NavLink>}
        {user?.is_staff && <NavLink to="/people" className={itemClass} aria-label={collapsed ? "People" : undefined} title={collapsed ? "People" : undefined}>
          <UsersRound className="h-4 w-4 shrink-0" aria-hidden="true" />{!collapsed && "People"}
        </NavLink>}
        <div className="mb-3">
          {collapsed ? <div className="my-2 border-t border-line/70" aria-hidden="true" /> :
            <p className="px-2.5 pb-1.5 pt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">Demo</p>}
          <NavLink to="/demo" end className={itemClass} aria-label={collapsed ? "Tickets" : undefined} title={collapsed ? "Tickets" : undefined}>
            <Ticket className="h-4 w-4 shrink-0" aria-hidden="true" /> {!collapsed && "Tickets"}
          </NavLink>
        </div>
      </nav>

    </aside>
  );
}
