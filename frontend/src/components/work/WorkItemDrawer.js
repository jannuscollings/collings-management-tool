import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import WorkItemPanel from "./WorkItemPanel";

const WorkItemContext = createContext({ revision: 0 });
export const useWorkItemContext = () => useContext(WorkItemContext);

export function WorkItemLink({ item, children, ...props }) {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  query.set("item", item.id);
  return <Link {...props} to={{ pathname: location.pathname, search: query.toString() }}>{children}</Link>;
}

export default function WorkItemDrawer({ children }) {
  const [params, setParams] = useSearchParams();
  const itemId = params.get("item");
  const [revision, setRevision] = useState(0);
  const dirty = useRef(false);
  const busy = useRef(false);
  const opener = useRef(null);
  useEffect(() => { dirty.current = false; busy.current = false; }, [itemId]);
  const close = () => {
    if (busy.current) return;
    if (dirty.current && !window.confirm("Discard unsaved work item changes?")) return;
    const next = new URLSearchParams(params);
    next.delete("item");
    setParams(next);
    dirty.current = false;
  };
  return (
    <WorkItemContext.Provider value={{ revision }}>
      {children}
      <Dialog.Root open={Boolean(itemId)} onOpenChange={(open) => { if (!open) close(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]" />
          <Dialog.Content
            onOpenAutoFocus={() => { opener.current = document.activeElement; }}
            onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus(); }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-canvas font-product text-ink shadow-overlay focus:outline-none sm:max-w-[820px]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-5 py-3">
              <div>
                <Dialog.Title className="text-sm font-extrabold">Work item</Dialog.Title>
                <Dialog.Description className="text-xs text-muted">Delivery details, collaboration and review</Dialog.Description>
              </div>
              <Dialog.Close className="rounded-ds-xs p-2 text-muted hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand" aria-label="Close work item"><X className="h-5 w-5" /></Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {itemId && <WorkItemPanel key={itemId} itemId={itemId}
                onChanged={() => setRevision((value) => value + 1)}
                onDirty={(value) => { dirty.current = value; }}
                onBusy={(value) => { busy.current = value; }} drawer />}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </WorkItemContext.Provider>
  );
}
