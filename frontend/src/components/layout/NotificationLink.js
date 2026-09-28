import { Bell } from "lucide-react";
import { DrawerLink, useWorkItemContext } from "../work/WorkItemDrawer";
export default function NotificationLink({ compact = false }) {
  const { unreadCount = 0 } = useWorkItemContext();
  return <DrawerLink drawer="notifications" aria-label={`Notifications, ${unreadCount} unread`}
    className="flex items-center gap-2 rounded-ds-sm px-2 py-2 text-xs font-semibold text-copy hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand">
    <Bell className="h-4 w-4" /><span className={compact ? "sr-only" : ""}>Notifications</span>{unreadCount > 0 && <span className="rounded-ds-pill bg-brand-soft px-2 text-brand-strong">{unreadCount}</span>}
  </DrawerLink>;
}
