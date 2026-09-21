import axios from "axios";
import toast from "react-hot-toast";

import store from "../store/store";
import { logout, setAccessToken } from "../store/slices/authSlice";

// Base URL: local backend by default, overridden by REACT_APP_API_URL per env.
// Mirrors the Collings CRM: JWT (Authorization header) + Django CSRF, with a
// single-flight refresh queue so a burst of 401s triggers one refresh, not many.
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/$/, ""),
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // send Django session/CSRF cookies
});

const getCookie = (name) => {
  const match = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
  return match ? decodeURIComponent(match.pop()) : null;
};

let memCsrfToken = null;
export const ensureCsrfToken = async () => {
  if (memCsrfToken) return memCsrfToken;
  try {
    const { data } = await axios.get(`${api.defaults.baseURL}/api/auth/csrf/`, {
      withCredentials: true,
    });
    memCsrfToken = data.csrfToken;
    return memCsrfToken;
  } catch (e) {
    console.warn("Failed to fetch CSRF token", e);
    return null;
  }
};

// ---- request: attach CSRF (unsafe methods) + JWT ----
api.interceptors.request.use((config) => {
  const safe = ["get", "head", "options"].includes((config.method || "").toLowerCase());
  if (!safe) {
    const csrf = getCookie("csrftoken") || memCsrfToken;
    if (csrf) config.headers["X-CSRFToken"] = csrf;
  }
  const token = localStorage.getItem("jwt_access");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// ---- response: refresh-on-401 with a single-flight queue ----
let isRefreshing = false;
let queue = [];
const flush = (error, token = null) => {
  queue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status !== 401 || original._retry || original.url?.includes("/auth/refresh/")) {
      return Promise.reject(error);
    }
    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject })).then((token) => {
        original.headers["Authorization"] = `Bearer ${token}`;
        return api(original);
      });
    }

    isRefreshing = true;
    const refresh = localStorage.getItem("jwt_refresh");
    try {
      if (!refresh) throw new Error("no refresh token");
      const { data } = await axios.post(
        `${api.defaults.baseURL}/api/auth/refresh/`,
        { refresh },
        { withCredentials: true }
      );
      localStorage.setItem("jwt_access", data.access);
      if (data.refresh) localStorage.setItem("jwt_refresh", data.refresh);
      store.dispatch(setAccessToken(data.access));
      flush(null, data.access);
      original.headers["Authorization"] = `Bearer ${data.access}`;
      return api(original);
    } catch (e) {
      flush(e, null);
      store.dispatch(logout());
      toast.error("Session expired, please sign in again.");
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
