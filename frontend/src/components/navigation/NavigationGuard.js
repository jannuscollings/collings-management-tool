import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useBlocker, useLocation } from "react-router-dom";

const NavigationGuardContext = createContext(null);
const shellPath = (path) => path === "/home" || path === "/my-work" ||
  /^\/requests(?:\/(?:new|[^/]+))?$/.test(path) ||
  /^\/workspaces\/[^/]+(?:\/items\/[^/]+)?$/.test(path);

export function drawerIdentity(location) {
  const query = new URLSearchParams(location.search);
  if (query.get("item")) return `item:${query.get("item")}`;
  if (query.get("request")) return `request:${query.get("request")}`;
  if (query.get("drawer")) return `drawer:${query.get("drawer")}:${query.get("drawer") === "new-work-item" ? query.get("drawerWorkspace") || "" : ""}`;
  return null;
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}

export function useDraftScope(scope, survives) {
  const guard = useNavigationGuard();
  const survivesRef = useRef(survives);
  survivesRef.current = survives;
  useEffect(() => () => guard?.remove(scope), [guard, scope]);
  return useCallback((dirty) => {
    guard?.set(scope, Boolean(dirty), (nextLocation) => survivesRef.current(nextLocation));
  }, [guard, scope]);
}

export default function NavigationGuard() {
  const location = useLocation();
  const scopes = useRef(new Map());
  const bypass = useRef(false);
  const [dirtyCount, setDirtyCount] = useState(0);
  const set = useCallback((scope, dirty, survives) => {
    if (dirty) scopes.current.set(scope, survives);
    else scopes.current.delete(scope);
    setDirtyCount(scopes.current.size);
  }, []);
  const remove = useCallback((scope) => {
    scopes.current.delete(scope);
    setDirtyCount(scopes.current.size);
  }, []);
  const confirmSignOut = useCallback(() => {
    if (scopes.current.size && !window.confirm("Discard unsaved changes?")) return false;
    bypass.current = true;
    return true;
  }, []);
  const blocker = useBlocker(({ nextLocation }) => !bypass.current &&
    [...scopes.current.values()].some((survives) => !survives(nextLocation)));

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Discard unsaved changes?")) {
      // Defer POP continuation until React Router has restored the current history entry.
      const timer = window.setTimeout(() => blocker.proceed(), 0);
      return () => window.clearTimeout(timer);
    }
    blocker.reset();
  }, [blocker]);
  useEffect(() => { bypass.current = false; }, [location]);
  useEffect(() => {
    if (!dirtyCount) return undefined;
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirtyCount]);
  const value = useMemo(() => ({ set, remove, confirmSignOut }), [set, remove, confirmSignOut]);

  return <NavigationGuardContext.Provider value={value}><Outlet /></NavigationGuardContext.Provider>;
}

export const drawerSurvives = (identity) => (nextLocation) => shellPath(nextLocation.pathname) && drawerIdentity(nextLocation) === identity;
export const pageSurvives = (pathname) => (nextLocation) => nextLocation.pathname === pathname;
