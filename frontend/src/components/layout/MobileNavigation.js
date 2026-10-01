import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Archive, Bell, Briefcase, Home, Layers3, MoreHorizontal, Settings2, Ticket, UsersRound, X } from "lucide-react";

import AccountMenu from "./AccountMenu";
import { DrawerLink, useWorkItemContext } from "../work/WorkItemDrawer";

const itemClass = (active) => `flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-ds-pill px-1 text-[10px] font-bold ${active ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-canvas hover:text-copy"}`;
const moreLinkClass = "flex min-h-11 items-center gap-3 rounded-ds-sm px-3 text-sm font-semibold text-copy hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand";

export default function MobileNavigation() {
  const user = useSelector((state) => state.auth.user);
  const { workspaces = [], workspaceLoadError, retryWorkspaces, unreadCount = 0 } = useWorkItemContext();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const query = new URLSearchParams(location.search);
  const notificationsActive = query.get("drawer") === "notifications";
  const moreActive = moreOpen || (!notificationsActive && (location.pathname.startsWith("/workspaces/") || location.pathname === "/archive" || location.pathname === "/people"));
  const drawerContainer = moreOpen ? document.getElementById("cmt-drawer-content") : null;

  useEffect(() => { setMoreOpen(false); }, [location.key]);

  const mainLink = (to, label, Icon, active) => <Link to={to} aria-current={active ? "page" : undefined} className={itemClass(active)}>
    <Icon className="h-5 w-5" aria-hidden="true" /><span>{label}</span>
  </Link>;

  return <>
    <nav aria-label="Mobile primary navigation" className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shell:hidden">
      <div className="mx-auto flex max-w-xl gap-0.5 rounded-ds-pill border border-line bg-surface/95 p-1.5 shadow-overlay backdrop-blur">
        {mainLink("/home", "Home", Home, !notificationsActive && location.pathname === "/home")}
        {mainLink("/my-work", "My Work", Briefcase, !notificationsActive && location.pathname === "/my-work")}
        {mainLink("/requests", "Requests", Ticket, !notificationsActive && location.pathname.startsWith("/requests"))}
        <DrawerLink drawer="notifications" aria-current={notificationsActive ? "page" : undefined} aria-label={`Notifications, ${unreadCount} unread`} className={itemClass(notificationsActive)}>
          <Bell className="h-5 w-5" aria-hidden="true" /><span>Notifications</span>
        </DrawerLink>
        <button type="button" onClick={() => setMoreOpen(true)} aria-current={moreActive ? "page" : undefined} aria-label="More" className={itemClass(moreActive)}>
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" /><span>More</span>
        </button>
      </div>
    </nav>
    <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
      <Dialog.Portal container={drawerContainer || undefined}>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/50 shell:hidden" />
        <Dialog.Content className="fixed inset-x-2 bottom-2 z-[70] mx-auto max-h-[min(85vh,700px)] max-w-xl overflow-y-auto rounded-ds-lg border border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-product text-copy shadow-overlay focus:outline-none shell:hidden" aria-describedby="mobile-more-description">
          <div className="mb-2 flex items-center justify-between">
            <Dialog.Title className="text-base font-extrabold text-ink">More</Dialog.Title>
            <Dialog.Close className="grid h-11 w-11 place-items-center rounded-ds-sm text-muted focus-visible:ring-2 focus-visible:ring-brand" aria-label="Close More"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <Dialog.Description id="mobile-more-description" className="sr-only">Workspaces, account, and other destinations.</Dialog.Description>
          <div className="border-t border-line py-3">
            <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-widest text-muted">Workspaces</p>
            {workspaces.map((workspace) => <Link key={workspace.id} to={`/workspaces/${workspace.slug}`} className={moreLinkClass}>
              <Layers3 className="h-4 w-4 shrink-0 text-brand-strong" aria-hidden="true" /><span className="truncate">{workspace.name}</span>
            </Link>)}
            {workspaceLoadError && <button type="button" onClick={retryWorkspaces} className={`${moreLinkClass} w-full text-brand-strong`}>Reload workspaces</button>}
            {user?.is_staff && <DrawerLink drawer="workspaces" className={moreLinkClass}>
              <Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" />Manage workspaces
            </DrawerLink>}
            {user?.is_staff && <Link to="/archive" className={moreLinkClass}>
              <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />Archive
            </Link>}
            {user?.is_staff && <Link to="/people" className={moreLinkClass}>
              <UsersRound className="h-4 w-4 shrink-0" aria-hidden="true" />People
            </Link>}
          </div>
          <div className="border-t border-line py-3">
            <Link to="/demo" className={moreLinkClass}><Ticket className="h-4 w-4" aria-hidden="true" />Demo tickets</Link>
          </div>
          <div className="border-t border-line pt-3">
            <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-widest text-muted">Account, theme & sign out</p>
            <AccountMenu />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
