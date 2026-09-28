import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Folder, LayoutGrid, Loader2, Search, X } from "lucide-react";

import { searchApi } from "../../api/search";

const EMPTY = { workItems: [], requests: [], workspaces: [], boards: [] };
const CATEGORIES = [
  ["all", "All"], ["workItems", "Work Items"], ["requests", "Requests"], ["places", "Workspaces & Boards"],
];
const statusNames = { new: "New", in_progress: "In progress", review: "Review", done: "Done", triaging: "Triaging", accepted: "Accepted", rejected: "Rejected" };
const priorityNames = { low: "Low", medium: "Medium", high: "High" };

function Highlight({ value, query }) {
  const text = String(value || "");
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (!query || index < 0) return text;
  return <>{text.slice(0, index)}<mark className="rounded bg-brand-soft text-brand-strong">{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

function destination(kind, result, location) {
  if (kind === "workspaces") return `/workspaces/${result.slug}`;
  if (kind === "boards") return `/workspaces/${result.workspaceSlug}?board=${result.id}`;
  const fullPageEditor = /^\/requests\/[^/]+$/.test(location.pathname) ||
    /^\/workspaces\/[^/]+\/items\/[^/]+$/.test(location.pathname);
  const path = fullPageEditor ? (kind === "workItems" ? `/workspaces/${result.workspaceSlug}` : "/requests") : location.pathname;
  const params = fullPageEditor ? new URLSearchParams() : new URLSearchParams(location.search);
  ["item", "request", "drawer", "drawerWorkspace"].forEach((key) => params.delete(key));
  params.set(kind === "workItems" ? "item" : "request", result.id);
  return { pathname: path, search: params.toString() };
}

function ResultPreview({ kind, result, query }) {
  if (kind === "workItems") return <>
    <span className="block text-[11px] text-muted">{result.workspaceName} › {result.boardName}</span>
    <span className="mt-1 block break-words text-sm font-bold text-ink"><span className="font-mono text-xs text-muted"><Highlight value={result.reference} query={query} /></span> <Highlight value={result.title} query={query} /></span>
    <span className="mt-1 block text-[11px] text-copy">{[statusNames[result.status] || result.status, priorityNames[result.priority] || result.priority, result.owner || "Unassigned", result.dueDate && `Due ${result.dueDate}`].filter(Boolean).join(" · ")}</span>
    {result.excerpt && <span className="mt-1 block truncate text-xs text-muted">“<Highlight value={result.excerpt} query={query} />”</span>}
  </>;
  if (kind === "requests") return <>
    <span className="block break-words text-sm font-bold text-ink"><span className="font-mono text-xs text-muted"><Highlight value={result.reference} query={query} /></span> <Highlight value={result.title} query={query} /></span>
    <span className="mt-1 block text-[11px] text-copy">{[statusNames[result.status] || result.status, result.requester, result.workspaceName && result.boardName && `${result.workspaceName} › ${result.boardName}`].filter(Boolean).join(" · ")}</span>
    {result.excerpt && <span className="mt-1 block truncate text-xs text-muted">“<Highlight value={result.excerpt} query={query} />”</span>}
  </>;
  return <span className="flex items-center gap-3">
    {kind === "boards" ? <LayoutGrid className="h-4 w-4 shrink-0 text-brand-strong" aria-hidden="true" /> : <Folder className="h-4 w-4 shrink-0 text-brand-strong" aria-hidden="true" />}
    <span className="min-w-0"><span className="block break-words text-sm font-bold text-ink"><Highlight value={result.name} query={query} /></span>{kind === "boards" && <span className="block text-[11px] text-muted">{result.workspaceName}</span>}</span>
  </span>;
}

export default function SearchDialog({ open, onOpenChange, triggerRef, returnFocusRef }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [category, setCategory] = useState("all");
  const [results, setResults] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const requestNumber = useRef(0);
  const navigatingFrom = useRef(null);
  const navigated = useRef(false);
  const query = input.trim().replace(/\s+/g, " ");
  const ready = query.length >= 2;
  const drawerContainer = open ? document.getElementById("cmt-drawer-content") : null;

  useEffect(() => {
    if (open) navigated.current = false;
    if (!open) {
      requestNumber.current += 1;
      setInput(""); setCategory("all"); setResults(EMPTY); setError(false); setLoading(false);
      navigatingFrom.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !ready) {
      requestNumber.current += 1;
      setResults(EMPTY); setError(false); setLoading(false);
      return undefined;
    }
    const number = ++requestNumber.current;
    const controller = new AbortController();
    setLoading(true); setError(false);
    const timer = window.setTimeout(() => {
      searchApi.search(query, controller.signal)
        .then(({ data }) => { if (number === requestNumber.current) { setResults(data.results); setHighlighted(0); } })
        .catch((reason) => { if (number === requestNumber.current && reason.code !== "ERR_CANCELED") setError(true); })
        .finally(() => { if (number === requestNumber.current) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query, ready, retry]);

  useEffect(() => {
    if (navigatingFrom.current && navigatingFrom.current !== location.key) {
      navigated.current = true;
      onOpenChange(false);
    }
  }, [location.key, onOpenChange]);

  const sections = useMemo(() => {
    const makeRows = (kind) => (results[kind] || []).map((result) => ({ kind, result }));
    const candidates = [
      { key: "workItems", label: "Work Items", rows: makeRows("workItems") },
      { key: "requests", label: "Requests", rows: makeRows("requests") },
      { key: "places", label: "Workspaces & Boards", rows: [...makeRows("workspaces"), ...makeRows("boards")] },
    ];
    return candidates.filter(({ key, rows }) => rows.length && (category === "all" || category === key));
  }, [category, results]);
  const flatResults = sections.flatMap(({ rows }) => rows);
  const openResult = ({ kind, result }) => {
    const current = new URLSearchParams(location.search);
    if ((kind === "workItems" && (current.get("item") === String(result.id) || location.pathname === `/workspaces/${result.workspaceSlug}/items/${result.id}`)) ||
        (kind === "requests" && (current.get("request") === String(result.id) || location.pathname === `/requests/${result.id}`))) {
      onOpenChange(false);
      return;
    }
    navigatingFrom.current = location.key;
    navigate(destination(kind, result, location));
  };
  const onInputKeyDown = (event) => {
    if (event.key === "ArrowDown" && flatResults.length) {
      event.preventDefault(); setHighlighted((value) => (value + 1) % flatResults.length);
    } else if (event.key === "ArrowUp" && flatResults.length) {
      event.preventDefault(); setHighlighted((value) => (value - 1 + flatResults.length) % flatResults.length);
    } else if (event.key === "Enter" && flatResults.length) {
      event.preventDefault(); openResult(flatResults[highlighted] || flatResults[0]);
    }
  };

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal container={drawerContainer || undefined}>
      <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/55" />
      <Dialog.Content aria-describedby="global-search-description" onCloseAutoFocus={(event) => { event.preventDefault(); if (!navigated.current) (returnFocusRef.current?.isConnected ? returnFocusRef.current : triggerRef.current)?.focus(); }}
        className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-surface font-product text-copy shadow-overlay focus:outline-none sm:inset-x-4 sm:inset-y-auto sm:top-[8vh] sm:mx-auto sm:h-[min(80vh,720px)] sm:max-w-3xl sm:rounded-ds-md sm:border sm:border-line">
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          <Dialog.Title className="sr-only">Search CMT</Dialog.Title>
          <input autoFocus type="search" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onInputKeyDown}
            aria-label="Search work, requests, and spaces" className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted" placeholder="Search work, requests, and spaces..." />
          <Dialog.Close className="grid h-11 w-11 shrink-0 place-items-center rounded-ds-xs text-muted hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand" aria-label="Close Search"><X className="h-5 w-5" /></Dialog.Close>
        </div>
        <p id="global-search-description" className="sr-only">Search across Work Items, Requests, Workspaces, and Boards.</p>
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2" role="tablist" aria-label="Search categories">
          {CATEGORIES.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={category === key} onClick={() => { setCategory(key); setHighlighted(0); }}
            className={`min-h-11 shrink-0 rounded-ds-xs px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${category === key ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-canvas hover:text-copy"}`}>{label}</button>)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-busy={loading}>
          {!query && <p className="py-12 text-center text-sm text-muted">Search across Work Items, Requests, Workspaces, and Boards.</p>}
          {query && !ready && <p className="py-12 text-center text-sm text-muted">Enter at least 2 characters to search.</p>}
          {error && <div role="alert" className="py-10 text-center text-sm">Search failed. <button type="button" onClick={() => setRetry((value) => value + 1)} className="font-bold text-brand-strong underline">Retry</button></div>}
          {ready && !error && <>
            {loading && <p role="status" className="mb-3 flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating results…</p>}
            {!loading && !flatResults.length && <p className="py-12 text-center text-sm text-muted">No matching work found. Try a title or reference.</p>}
            {sections.map(({ key, label: sectionLabel, rows }) => <section key={key} className="mb-5">
              <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-muted">{sectionLabel}</h3>
              <div className="space-y-1">{rows.map(({ kind, result }) => {
                const index = flatResults.findIndex((row) => row.kind === kind && row.result.id === result.id);
                const label = `${kind === "workItems" ? "Work Item" : kind === "requests" ? "Request" : kind === "boards" ? "Board" : "Workspace"} ${result.reference || ""} ${result.title || result.name} ${result.workspaceName || ""} ${result.boardName || ""}`.trim();
                return <button key={`${kind}-${result.id}`} type="button" aria-label={label} onMouseEnter={() => setHighlighted(index)} onClick={() => openResult({ kind, result })}
                  className={`block min-h-11 w-full rounded-ds-sm border px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${highlighted === index ? "border-brand/40 bg-brand-soft/40" : "border-transparent hover:bg-canvas"}`}>
                  <ResultPreview kind={kind} result={result} query={query} />
                </button>;
              })}</div>
            </section>)}
          </>}
        </div>
        <p className="shrink-0 border-t border-line px-4 py-3 text-[11px] text-muted">↑ ↓ Select result · Enter Open · Esc Close</p>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
