import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import NewRequestForm from "../requests/NewRequestForm";
import RequestDetailPanel from "../requests/RequestDetailPanel";
import NewWorkItemForm from "./NewWorkItemForm";
import WorkItemPanel from "./WorkItemPanel";
import WorkspaceManagerPanel from "./WorkspaceManagerPanel";
import { workApi } from "../../api/work";
import { awarenessApi } from "../../api/awareness";
import NotificationsPanel from "./NotificationsPanel";
import { drawerIdentity, drawerSurvives, useDraftScope, useNavigationGuard } from "../navigation/NavigationGuard";

const WorkItemContext = createContext({ revision: 0, requestRevision: 0, workspaceRevision: 0, workspaces: [] });
export const useWorkItemContext = () => useContext(WorkItemContext);

export function WorkItemLink({ item, children, ...props }) {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  query.delete("drawer");
  query.delete("drawerWorkspace");
  query.delete("request");
  query.set("item", item.id);
  return <Link {...props} to={{ pathname: location.pathname, search: query.toString() }}>{children}</Link>;
}

export function RequestLink({ request, children, ...props }) {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  query.delete("item");
  query.delete("drawer");
  query.delete("drawerWorkspace");
  query.set("request", request.id);
  return <Link {...props} to={{ pathname: location.pathname, search: query.toString() }}>{children}</Link>;
}

export function DrawerLink({ drawer, drawerParams = {}, children, ...props }) {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  query.delete("item");
  query.delete("request");
  query.delete("drawerWorkspace");
  query.set("drawer", drawer);
  Object.entries(drawerParams).forEach(([key, value]) => query.set(key, value));
  return <Link {...props} to={{ pathname: location.pathname, search: query.toString() }}>{children}</Link>;
}

export default function WorkItemDrawer({ children }) {
  const isAdmin = useSelector((state) => state.auth.user?.is_staff);
  const [params, setParams] = useSearchParams();
  const itemId = params.get("item");
  const requestId = params.get("request");
  const drawer = params.get("drawer");
  const drawerWorkspace = params.get("drawerWorkspace");
  const [revision, setRevision] = useState(0);
  const [requestRevision, setRequestRevision] = useState(0);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceLoadError, setWorkspaceLoadError] = useState(false);
  const [workspaceRetry, setWorkspaceRetry] = useState(0);
  const [inbox, setInbox] = useState({ items: [], unread_count: 0, next_before: null });
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState(false);
  const [inboxRevision, setInboxRevision] = useState(0);
  const refreshInbox = useCallback(() => setInboxRevision(x => x + 1), []);
  const location = useLocation();
  const activeDrawerIdentity = drawerIdentity(location);
  const navigationGuard = useNavigationGuard();
  const setDrawerScopeDirty = useDraftScope("drawer", drawerSurvives(activeDrawerIdentity));
  useEffect(() => {
    let active = true;
    setInboxLoading(true); setInboxError(false);
    awarenessApi.notifications().then(({ data }) => { if (active) setInbox(data); })
      .catch(() => { if (active) { setInboxError(true); setInbox({ items: [], unread_count: 0, next_before: null }); } })
      .finally(() => { if (active) setInboxLoading(false); });
    return () => { active = false; };
  }, [inboxRevision, revision, requestRevision, workspaceRevision, location.pathname, drawer]);
  useEffect(() => { window.addEventListener('focus', refreshInbox); return () => window.removeEventListener('focus', refreshInbox); }, [refreshInbox]);
  const dirty = useRef(false);
  const busy = useRef(false);
  const opener = useRef(null);
  useEffect(() => {
    let active = true;
    let retryTimer;
    setWorkspaceLoadError(false);
    const load = (attempt = 0) => {
      workApi.listWorkspaces()
        .then(({ data }) => {
          if (active) setWorkspaces(data);
        })
        .catch(() => {
          if (!active) return;
          if (attempt === 0) retryTimer = window.setTimeout(() => load(1), 1000);
          else setWorkspaceLoadError(true);
        });
    };
    load();
    return () => { active = false; window.clearTimeout(retryTimer); };
  }, [workspaceRevision, workspaceRetry, location.pathname]);
  useEffect(() => { dirty.current = false; busy.current = false; setDrawerScopeDirty(false); }, [activeDrawerIdentity, setDrawerScopeDirty]);
  const close = () => {
    if (busy.current) return;
    if (!navigationGuard && dirty.current && !window.confirm("Discard unsaved changes?")) return;
    const next = new URLSearchParams(params);
    next.delete("item");
    next.delete("request");
    next.delete("drawer");
    next.delete("drawerWorkspace");
    setParams(next);
  };
  const openRequest = (request) => {
    setDirty(false);
    busy.current = false;
    const next = new URLSearchParams(params);
    next.delete("item");
    next.delete("drawer");
    next.delete("drawerWorkspace");
    next.set("request", request.id);
    setRequestRevision((value) => value + 1);
    setParams(next, { replace: true });
  };
  const setDirty = useCallback((value) => { dirty.current = value; setDrawerScopeDirty(value); }, [setDrawerScopeDirty]);
  const setBusy = useCallback((value) => { busy.current = value; }, []);
  const openItem = (item) => {
    setDirty(false);
    busy.current = false;
    const next = new URLSearchParams(params);
    next.delete("request");
    next.delete("drawer");
    next.delete("drawerWorkspace");
    next.set("item", item.id);
    setRevision((value) => value + 1);
    setParams(next);
  };
  const titles = {
    "new-work-item": ["New work item", "Create delivery work without leaving the workspace"],
    "new-request": ["Request internal work", "Submit a Creative & Design request for triage"],
    notifications: ["Notifications", "Updates that need your attention"],
    workspaces: ["Manage workspaces", "Create, rename, order and archive workspaces"],
  };
  const adminDrawerBlocked = !isAdmin && !itemId && !requestId && (drawer === "new-work-item" || drawer === "workspaces");
  const [title, description] = adminDrawerBlocked
    ? ["Unavailable", "This action is available to administrators"]
    : itemId
    ? ["Work item", "Delivery details, collaboration and review"]
    : requestId
      ? ["Request", "Submitted details, triage and delivery outcome"]
    : titles[drawer] || ["Panel", ""];
  return (
    <WorkItemContext.Provider value={{ revision, requestRevision, workspaceRevision, workspaces, workspaceLoadError, retryWorkspaces: () => setWorkspaceRetry((value) => value + 1), unreadCount: inbox.unread_count }}>
      {children}
      <Dialog.Root open={Boolean(itemId || requestId || drawer)} onOpenChange={(open) => { if (!open) close(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]" />
          <Dialog.Content
            id="cmt-drawer-content"
            onOpenAutoFocus={() => { opener.current = document.activeElement; }}
            onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus(); }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-canvas font-product text-ink shadow-overlay focus:outline-none sm:max-w-[820px]"
          >
            <div className={itemId ? "flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2 shell:px-5 shell:py-3" : "flex shrink-0 items-center justify-between border-b border-line bg-surface px-5 py-3"}>
              <div className={itemId ? "min-w-0" : undefined}>
                <Dialog.Title className="text-sm font-extrabold">{title}</Dialog.Title>
                <Dialog.Description className={itemId ? "break-words text-xs text-muted" : "text-xs text-muted"}>{description}</Dialog.Description>
              </div>
              <Dialog.Close className={itemId ? "grid min-h-11 min-w-11 shrink-0 place-items-center rounded-ds-xs text-muted hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand shell:min-h-0 shell:min-w-0 shell:p-2" : "rounded-ds-xs p-2 text-muted hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand"} aria-label={`Close ${title.toLowerCase()}`}><X className="h-5 w-5" /></Dialog.Close>
            </div>
            <div className={itemId ? "min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-16 sm:p-6 sm:pb-16 shell:pb-6" : "min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"}>
              {adminDrawerBlocked && <p role="status" className="text-sm text-muted">This action is available to administrators.</p>}
              {itemId && <WorkItemPanel key={itemId} itemId={itemId}
                onChanged={() => setRevision((value) => value + 1)}
                onDirty={setDirty}
                onBusy={setBusy} drawer />}
              {!itemId && requestId && <RequestDetailPanel key={requestId} requestId={requestId}
                onChanged={() => setRequestRevision((value) => value + 1)}
                onDirty={setDirty}
                onBusy={setBusy} drawer />}
              {!itemId && !requestId && isAdmin && drawer === "new-work-item" && drawerWorkspace && (
                <NewWorkItemForm workspaceSlug={drawerWorkspace} onCreated={openItem} onDirty={setDirty} onBusy={setBusy} />
              )}
              {!itemId && !requestId && drawer === "new-request" && (
                <NewRequestForm
                  onCreated={openRequest}
                  onDirty={setDirty}
                  onBusy={setBusy}
                />
              )}
              {!itemId && !requestId && drawer === "notifications" && (
                <NotificationsPanel inbox={inbox} loading={inboxLoading} error={inboxError} refresh={refreshInbox} />
              )}
              {!itemId && !requestId && isAdmin && drawer === "workspaces" && (
                <WorkspaceManagerPanel
                  onChanged={() => setWorkspaceRevision((value) => value + 1)}
                  onDirty={setDirty}
                  onBusy={setBusy}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </WorkItemContext.Provider>
  );
}
