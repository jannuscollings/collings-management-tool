import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Sparkles, X } from "lucide-react";
import SearchDialog from "../search/SearchDialog";

const ACTIONS = [
  { key: "work", label: "Create a Work Item", aliases: ["create work item", "new work item"], admin: true },
  { key: "request", label: "Create a Request", aliases: ["create request", "new request"] },
  { key: "mine", label: "Find my work", aliases: ["my work", "find my work"] },
  { key: "overdue", label: "Show what's overdue", aliases: ["overdue", "show overdue", "show what's overdue"] },
  { key: "review", label: "Show what's waiting for my review", aliases: ["waiting for review", "my reviews", "show what's waiting for my review"] },
  { key: "search", label: "Search CMT", aliases: ["search", "search cmt"] },
];

export function resolveDomaCommand(value, isAdmin) {
  const query = value.trim().replace(/\s+/g, " ").toLowerCase();
  if (!query) return null;
  const action = ACTIONS.find(({ label, aliases }) => label.toLowerCase() === query || aliases.includes(query));
  if (action) return action.admin && !isAdmin ? "forbidden" : action.key;
  // Until DOMA has a service, unmatched prompts use CMT's existing search.
  return "search-query";
}

export default function AskDoma({ isAdmin, workspaces = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chooseWorkspace, setChooseWorkspace] = useState(false);
  const [message, setMessage] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mainLeft, setMainLeft] = useState(0);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const workspaceRef = useRef(null);
  const backRef = useRef(null);
  const restoreFocus = useRef(false);
  useLayoutEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return undefined;
    const update = () => setMainLeft(main.getBoundingClientRect().left);
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(main);
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  useEffect(() => {
    if (open) (chooseWorkspace ? workspaceRef.current || backRef.current : inputRef.current)?.focus();
    else if (restoreFocus.current) { triggerRef.current?.focus(); restoreFocus.current = false; }
  }, [open, chooseWorkspace]);
  useEffect(() => { setOpen(false); setChooseWorkspace(false); setQuery(""); }, [location.key]);

  const close = () => { restoreFocus.current = true; setOpen(false); setChooseWorkspace(false); setMessage(""); setQuery(""); };
  const search = (value) => { setSearchQuery(value); setSearchOpen(true); setOpen(false); setChooseWorkspace(false); setMessage(""); };
  const run = (command, value = "") => {
    setMessage("");
    if (command === "forbidden") { setMessage("Work Item creation is available to administrators."); return; }
    if (command === "work") { setChooseWorkspace(true); return; }
    if (command === "request") navigate("/home?drawer=new-request");
    else if (command === "mine") navigate("/my-work");
    else if (command === "overdue") navigate("/my-work?due=overdue");
    else if (command === "review") navigate("/home?view=review");
    else search(command === "search" ? "" : value.trim());
  };
  const submit = (event) => {
    event.preventDefault();
    const command = resolveDomaCommand(query, isAdmin);
    if (command) run(command, query);
  };

  return <>
    <div style={{ "--doma-content-left": `${mainLeft}px` }} className="pointer-events-none fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 shell:bottom-6 shell:left-[var(--doma-content-left)] shell:right-0">
      {!open ? <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-expanded="false" aria-label="Ask DOMA" className="pointer-events-auto mx-auto flex min-h-12 w-full max-w-[400px] items-center justify-center gap-3 rounded-full border border-line bg-surface px-5 text-center text-sm font-semibold text-ink shadow-panel transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-brand/60 hover:shadow-[0_0_0_4px_rgb(var(--color-brand)/0.10),0_14px_28px_rgb(15_35_40/0.14)] focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:shadow-[0_0_0_4px_rgb(var(--color-brand)/0.10),0_14px_28px_rgb(15_35_40/0.14)] motion-reduce:transform-none dark:hover:border-brand/70"><Sparkles className="h-4 w-4 shrink-0 text-brand-strong dark:text-brand" aria-hidden="true" />Ask DOMA…</button>
        : <div className="pointer-events-auto mx-auto max-h-[min(65vh,480px)] w-full max-w-xl overflow-y-auto rounded-ds-lg border border-line bg-surface p-3 shadow-overlay" role="region" aria-label="Ask DOMA commands" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
          <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-extrabold text-ink"><Sparkles className="h-4 w-4 text-brand-strong" aria-hidden="true" />Ask DOMA</span><button type="button" aria-label="Close Ask DOMA" onClick={close} className="grid h-9 w-9 place-items-center rounded-ds-xs text-muted hover:bg-canvas"><X className="h-4 w-4" /></button></div>
          {chooseWorkspace ? <>
            <p className="mb-2 text-xs text-muted">Choose a workspace for the new Work Item.</p>
            {workspaces.length ? <div className="grid gap-1">{workspaces.map((workspace, index) => <button ref={index === 0 ? workspaceRef : undefined} type="button" key={workspace.id} onClick={() => navigate(`/workspaces/${workspace.slug}?drawer=new-work-item&drawerWorkspace=${workspace.slug}`)} className="min-h-11 rounded-ds-xs px-3 text-left text-sm font-semibold text-copy hover:bg-canvas">{workspace.name}</button>)}</div> : <p className="py-2 text-xs text-muted">No active workspaces are available.</p>}
            <button ref={backRef} type="button" onClick={() => setChooseWorkspace(false)} className="mt-2 text-xs font-bold text-brand-strong">Back to commands</button>
          </> : <>
            <form onSubmit={submit} className="flex items-center gap-2 rounded-ds-sm border border-line bg-canvas px-3"><Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setMessage(""); }} aria-label="Ask DOMA command" placeholder="Find, create, or navigate…" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" /><button type="submit" disabled={!query.trim()} className="text-xs font-bold text-brand-strong disabled:opacity-40">Go</button></form>
            {message && <p role="status" className="mt-2 text-xs text-muted">{message}</p>}
            <p className="mt-3 px-1 text-[10px] font-extrabold uppercase tracking-wider text-muted">Try an action</p>
            <div className="mt-1 grid gap-1">{ACTIONS.filter((action) => !action.admin || isAdmin).map((action) => <button key={action.key} type="button" onClick={() => run(action.key)} className="min-h-10 rounded-ds-xs px-3 text-left text-xs font-semibold text-copy hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{action.label}</button>)}</div>
            <p className="mt-2 px-1 text-[11px] text-muted">Other text opens CMT search.</p>
          </>}
        </div>}
    </div>
    <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} triggerRef={triggerRef} returnFocusRef={triggerRef} initialQuery={searchQuery} />
  </>;
}
