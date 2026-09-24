import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { LogIn } from "lucide-react";

import { login } from "../store/slices/authSlice";

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status } = useSelector((s) => s.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(login({ email, password }));
    if (login.fulfilled.match(res)) {
      toast.success("Welcome back");
      navigate("/home");
    } else {
      toast.error(res.payload || "Login failed");
    }
  };

  return (
    <div className="grid h-full place-items-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-black/10 p-8 shadow-sm dark:border-white/10"
      >
        <div className="flex items-center gap-2 text-lg font-semibold">
          <LogIn className="h-5 w-5 text-primary" /> Sign in
        </div>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/15"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/15"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-secondary transition hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading" ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
