import api, { ensureCsrfToken } from "./index";

export const authApi = {
  register: (payload) => api.post("/api/auth/register/", payload),
  login: async (email, password) => {
    await ensureCsrfToken();
    return api.post("/api/auth/login/", { email, password });
  },
  me: () => api.get("/api/auth/me/"),
  updateProfile: (payload) => api.patch("/api/auth/me/", payload),
  photo: () => api.get("/api/auth/me/photo/", { responseType: "blob" }),
  userPhoto: (id) => api.get(`/api/auth/users/${id}/photo/`, { responseType: "blob" }),
  uploadPhoto: (file) => {
    const body = new FormData();
    body.append("photo", file);
    return api.post("/api/auth/me/photo/", body, { headers: { "Content-Type": "multipart/form-data" } });
  },
  removePhoto: () => api.delete("/api/auth/me/photo/"),
};
