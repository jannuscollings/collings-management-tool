import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Briefcase, ChevronUp, LogOut, Moon, Sun, UserRound } from "lucide-react";

import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../lib/cn";
import { logout } from "../../store/slices/authSlice";
import { useNavigationGuard } from "../navigation/NavigationGuard";
import ProfileAvatar from "../profile/ProfileAvatar";

export default function AccountMenu({ compact = false }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { theme, toggle } = useTheme();
  const navigationGuard = useNavigationGuard();
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Account";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center rounded-ds-sm border border-line bg-surface text-left text-copy transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20",
            compact ? "h-9 w-9 justify-center" : "w-full gap-2.5 px-2.5 py-2"
          )}
          aria-label="Open account menu"
        >
          <ProfileAvatar user={user} className="h-7 w-7 text-[10px]" />
          {!compact && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">{name}</span>
                <span className="block truncate text-[10px] text-muted">{user?.is_staff ? "Administrator" : user?.email}</span>
              </span>
              <ChevronUp className="h-3.5 w-3.5 text-muted" />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={compact ? "bottom" : "top"}
          align="end"
          sideOffset={8}
          className="z-[70] w-64 rounded-ds-md border border-line bg-surface p-2 font-product text-copy shadow-overlay"
        >
          <div className="border-b border-line px-2.5 py-2">
            <p className="truncate text-sm font-extrabold text-ink">{name}</p>
            <p className="truncate text-[11px] text-muted">{user?.email}</p>
            {user?.is_staff && <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-brand-strong">Administrator</p>}
          </div>
          <DropdownMenu.Item asChild>
            <Link to="/profile" className="mt-1 flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-ds-xs px-2.5 text-xs font-semibold outline-none hover:bg-canvas focus:bg-canvas">
              <UserRound className="h-4 w-4" /> My Profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link to="/my-work" className="mt-1 flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-ds-xs px-2.5 text-xs font-semibold outline-none hover:bg-canvas focus:bg-canvas">
              <Briefcase className="h-4 w-4" /> My Work
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={toggle} className="flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-ds-xs px-2.5 text-xs font-semibold outline-none hover:bg-canvas focus:bg-canvas">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Use light mode" : "Use dark mode"}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item onSelect={() => { if (navigationGuard?.confirmSignOut() !== false) dispatch(logout()); }} className="flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-ds-xs px-2.5 text-xs font-semibold text-critical outline-none hover:bg-critical/5 focus:bg-critical/5">
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
