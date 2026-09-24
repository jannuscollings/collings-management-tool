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
  listWorkspaces: (params = {}) => api.get("/api/workspaces/", { params }),
  getWorkspace: (slug) => api.get(`/api/workspaces/${slug}/`),
  createWorkspace: (payload) => api.post("/api/workspaces/", payload),
  updateWorkspace: (slug, payload) => api.patch(`/api/workspaces/${slug}/`, payload),
  archiveWorkspace: (slug) => api.post(`/api/workspaces/${slug}/archive/`),
  restoreWorkspace: (slug) => api.post(`/api/workspaces/${slug}/restore/`),
  reorderWorkspaces: (workspaceIds) => api.post("/api/workspaces/reorder/", { workspace_ids: workspaceIds }),
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
