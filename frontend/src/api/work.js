import api from "./index";

export const workApi = {
  listComments: (id) => api.get(`/api/work-items/${id}/comments/`),
  createComment: (id, payload) => api.post(`/api/work-items/${id}/comments/`, payload),
  listActivity: (id) => api.get(`/api/work-items/${id}/activity/`),
  listSubWork: (id) => api.get(`/api/work-items/${id}/sub-work/`),
  createSubWork: (id, payload) => api.post(`/api/work-items/${id}/sub-work/`, payload),
  updateSubWork: (id, subId, payload) => api.patch(`/api/work-items/${id}/sub-work/${subId}/`, payload),
  listLinks: (id) => api.get(`/api/work-items/${id}/links/`),
  createLink: (id, payload) => api.post(`/api/work-items/${id}/links/`, payload),
  removeLink: (id, linkId) => api.delete(`/api/work-items/${id}/links/${linkId}/`),
  review: (id, payload) => api.post(`/api/work-items/${id}/review/`, payload),
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
