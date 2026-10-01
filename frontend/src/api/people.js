import api from "./index";

export const peopleApi = {
  list: () => api.get("/api/auth/people/"),
  create: (payload) => api.post("/api/auth/people/", payload),
  update: (id, payload) => api.patch(`/api/auth/people/${id}/`, payload),
};
