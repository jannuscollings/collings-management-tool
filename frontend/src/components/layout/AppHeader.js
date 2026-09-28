import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

import AccountMenu from "./AccountMenu";
import NotificationLink from "./NotificationLink";
import SearchDialog from "../search/SearchDialog";

export default function AppHeader() {
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
    <div className="flex min-h-16 items-center gap-3">
      <Link to="/home" className="shrink-0 text-xs font-extrabold tracking-[0.16em] text-copy shell:hidden">COLLINGS</Link>
      <span className="hidden shrink-0 text-xs font-bold text-copy shell:inline">CMT</span>
      <button ref={trigger} type="button" onClick={() => { returnFocus.current = trigger.current; setOpen(true); }}
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
