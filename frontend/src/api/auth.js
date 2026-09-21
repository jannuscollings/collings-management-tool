import api, { ensureCsrfToken } from "./index";

export const authApi = {
  register: (payload) => api.post("/api/auth/register/", payload),
  login: async (email, password) => {
    await ensureCsrfToken();
    return api.post("/api/auth/login/", { email, password });
  },
  me: () => api.get("/api/auth/me/"),
};
