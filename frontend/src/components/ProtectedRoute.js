import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

import { loadUser } from "../store/slices/authSlice";

export default function ProtectedRoute({ children }) {
  const dispatch = useDispatch();
  const { user, status } = useSelector((s) => s.auth);
  const hasToken = !!localStorage.getItem("jwt_access");

  useEffect(() => {
    if (hasToken && !user && status !== "loading") dispatch(loadUser());
  }, [hasToken, user, status, dispatch]);

  if (!hasToken) return <Navigate to="/login" replace />;
  if (!user && status !== "error") {
    return <div className="grid h-full place-items-center text-sm opacity-70">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
