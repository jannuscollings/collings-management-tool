import axios from "axios";
import toast from "react-hot-toast";

// Base URL: local backend by default, overridden by REACT_APP_API_URL per env.
// Mirrors the Collings CRM: JWT (Authorization header) + Django CSRF, with a
// single-flight refresh queue so a burst of 401s triggers one refresh, not many.
//
// NOTE: this module deliberately does NOT import the Redux store. The store is
// built from authSlice, which imports the API layer — importing the store back
// here would be a circular dependency that leaves `authReducer` undefined at
// startup (blank screen). On a failed refresh we clear tokens and redirect
// instead; the app re-reads auth state from localStorage on the next load.
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

const forceLogin = () => {
  localStorage.removeItem("jwt_access");
  localStorage.removeItem("jwt_refresh");
  if (window.location.pathname !== "/login") window.location.href = "/login";
};

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

    if (status !== 401 || !original || original._retry || original.url?.includes("/auth/refresh/")) {
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
      flush(null, data.access);
      original.headers["Authorization"] = `Bearer ${data.access}`;
      return api(original);
    } catch (e) {
      flush(e, null);
      toast.error("Session expired, please sign in again.");
      forceLogin();
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
