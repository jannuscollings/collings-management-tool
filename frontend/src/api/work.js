import api from "./index";

export const workApi = {
  getWorkspace: (slug) => api.get(`/api/workspaces/${slug}/`),
  listWorkItems: (params = {}) => api.get("/api/work-items/", { params }),
  getItem: (id) => api.get(`/api/work-items/${id}/`),
  createItem: (payload) => api.post("/api/work-items/", payload),
  updateItem: (id, payload) => api.patch(`/api/work-items/${id}/`, payload),
  listUsers: () => api.get("/api/work-users/"),
};

export const WORK_STATUS_OPTIONS = [
  ["new", "New"],
  ["in_progress", "In progress"],
  ["review", "Review"],
  ["done", "Done"],
];

export const WORK_PRIORITY_OPTIONS = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
];
