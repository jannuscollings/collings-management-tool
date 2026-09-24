import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import NewRequestForm from "../requests/NewRequestForm";
import RequestDetailPanel from "../requests/RequestDetailPanel";
import NewWorkItemForm from "./NewWorkItemForm";
import WorkItemPanel from "./WorkItemPanel";
import WorkspaceManagerPanel from "./WorkspaceManagerPanel";
import { workApi } from "../../api/work";

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
  const [params, setParams] = useSearchParams();
  const itemId = params.get("item");
  const requestId = params.get("request");
  const drawer = params.get("drawer");
  const drawerWorkspace = params.get("drawerWorkspace");
  const [revision, setRevision] = useState(0);
  const [requestRevision, setRequestRevision] = useState(0);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [workspaces, setWorkspaces] = useState([]);
  const dirty = useRef(false);
  const busy = useRef(false);
  const opener = useRef(null);
  useEffect(() => {
    let active = true;
    workApi.listWorkspaces()
      .then(({ data }) => { if (active) setWorkspaces(data); })
      .catch(() => { if (active) setWorkspaces([]); });
    return () => { active = false; };
  }, [workspaceRevision]);
  useEffect(() => { dirty.current = false; busy.current = false; }, [itemId, requestId, drawer]);
  const close = () => {
    if (busy.current) return;
    if (dirty.current && !window.confirm("Discard unsaved changes?")) return;
    const next = new URLSearchParams(params);
    next.delete("item");
    next.delete("request");
    next.delete("drawer");
    next.delete("drawerWorkspace");
    setParams(next);
    dirty.current = false;
  };
  const openRequest = (request) => {
    dirty.current = false;
    busy.current = false;
    const next = new URLSearchParams(params);
    next.delete("item");
    next.delete("drawer");
    next.delete("drawerWorkspace");
    next.set("request", request.id);
    setRequestRevision((value) => value + 1);
    setParams(next, { replace: true });
  };
  const setDirty = useCallback((value) => { dirty.current = value; }, []);
  const setBusy = useCallback((value) => { busy.current = value; }, []);
  const openItem = (item) => {
    dirty.current = false;
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
    workspaces: ["Manage workspaces", "Create, rename, order and archive workspaces"],
  };
  const [title, description] = itemId
    ? ["Work item", "Delivery details, collaboration and review"]
    : requestId
      ? ["Request", "Submitted details, triage and delivery outcome"]
    : titles[drawer] || ["Panel", ""];
  return (
    <WorkItemContext.Provider value={{ revision, requestRevision, workspaceRevision, workspaces }}>
      {children}
      <Dialog.Root open={Boolean(itemId || requestId || drawer)} onOpenChange={(open) => { if (!open) close(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]" />
          <Dialog.Content
            onOpenAutoFocus={() => { opener.current = document.activeElement; }}
            onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus(); }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-canvas font-product text-ink shadow-overlay focus:outline-none sm:max-w-[820px]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-5 py-3">
              <div>
                <Dialog.Title className="text-sm font-extrabold">{title}</Dialog.Title>
                <Dialog.Description className="text-xs text-muted">{description}</Dialog.Description>
              </div>
              <Dialog.Close className="rounded-ds-xs p-2 text-muted hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand" aria-label={`Close ${title.toLowerCase()}`}><X className="h-5 w-5" /></Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {itemId && <WorkItemPanel key={itemId} itemId={itemId}
                onChanged={() => setRevision((value) => value + 1)}
                onDirty={setDirty}
                onBusy={setBusy} drawer />}
              {!itemId && requestId && <RequestDetailPanel key={requestId} requestId={requestId}
                onChanged={() => setRequestRevision((value) => value + 1)}
                onDirty={setDirty}
                onBusy={setBusy} drawer />}
              {!itemId && !requestId && drawer === "new-work-item" && drawerWorkspace && (
                <NewWorkItemForm workspaceSlug={drawerWorkspace} onCreated={openItem} onDirty={setDirty} onBusy={setBusy} />
              )}
              {!itemId && !requestId && drawer === "new-request" && (
                <NewRequestForm
                  onCreated={openRequest}
                  onDirty={setDirty}
                  onBusy={setBusy}
                />
              )}
              {!itemId && !requestId && drawer === "workspaces" && (
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
