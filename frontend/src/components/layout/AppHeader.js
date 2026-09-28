import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";

import AccountMenu from "./AccountMenu";
import NotificationLink from "./NotificationLink";
import SearchDialog from "../search/SearchDialog";
import { useWorkItemContext } from "../work/WorkItemDrawer";

function mobileContext(location, workspaces) {
  const path = location.pathname;
  const query = new URLSearchParams(location.search);
  if (query.get("drawer") === "notifications") return ["Updates", "Notifications"];
  if (path === "/home") return ["Your overview", "Home"];
  if (path === "/my-work") return ["Assigned to you", "My Work"];
  if (path === "/requests/new") return ["Requests", "New request"];
  if (path.startsWith("/requests")) return ["Work intake", "Requests"];
  if (path.startsWith("/workspaces/")) {
    const slug = path.split("/")[2];
    const name = workspaces.find((workspace) => workspace.slug === slug)?.name || "Workspace";
    return [path.includes("/items/") ? name : "Workspace", path.includes("/items/") ? "Work item" : name];
  }
  return ["Collings", "CMT"];
}

export default function AppHeader() {
  const location = useLocation();
  const { workspaces = [] } = useWorkItemContext();
  const [eyebrow, title] = mobileContext(location, workspaces);
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const returnFocus = useRef(null);
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!open) returnFocus.current = document.activeElement;
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6" aria-label="Application header">
    <div className="flex min-h-16 items-center gap-3 shell:hidden">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted">{eyebrow}</p>
        <p className="truncate text-base font-extrabold text-ink">{title}</p>
      </div>
      <button ref={trigger} type="button" onClick={() => { returnFocus.current = trigger.current; setOpen(true); }}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-ds-sm border border-line bg-canvas text-copy focus-visible:ring-4 focus-visible:ring-brand/20"
        aria-label="Search work, requests, and spaces"><Search className="h-5 w-5" aria-hidden="true" /></button>
    </div>
    <div className="hidden min-h-16 items-center gap-3 shell:flex">
      <span className="shrink-0 text-xs font-bold text-copy">CMT</span>
      <button type="button" onClick={() => { returnFocus.current = document.activeElement; setOpen(true); }}
        className="mx-auto flex min-h-11 w-full max-w-xl items-center gap-2 rounded-ds-sm border border-line bg-canvas px-3 text-left text-xs text-muted transition-colors hover:border-brand/40 hover:text-copy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
        aria-label="Search work, requests, and spaces">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate"><span className="sm:hidden">Search</span><span className="hidden sm:inline">Search work, requests, and spaces...</span></span>
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] sm:inline">{shortcut}</kbd>
      </button>
      <div className="flex shrink-0 items-center gap-2"><NotificationLink compact /><AccountMenu compact /></div>
    </div>
    <SearchDialog open={open} onOpenChange={setOpen} triggerRef={trigger} returnFocusRef={returnFocus} />
  </header>;
}
