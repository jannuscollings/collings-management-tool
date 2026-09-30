import api from "./index";

export const workApi = {
  listComments: (id) => api.get(`/api/work-items/${id}/comments/`),
  createComment: (id, payload) => {
    if (!payload.attachments?.length) return api.post(`/api/work-items/${id}/comments/`, payload);
    const form = new FormData();
    form.append('body', payload.body);
    payload.mentions.forEach((mention) => form.append('mentions', mention));
    if (payload.parent) form.append('parent', payload.parent);
    payload.attachments.forEach((file) => form.append('attachments', file));
    return api.post(`/api/work-items/${id}/comments/`, form, { headers: { 'Content-Type': undefined } });
  },
  getCommentAttachment: (id, commentId, attachmentId) => api.get(
    `/api/work-items/${id}/comments/${commentId}/attachments/${attachmentId}/`, { responseType: 'blob' }
  ),
  editComment: (id, commentId, payload) => api.patch(`/api/work-items/${id}/comments/${commentId}/`, payload),
  deleteComment: (id, commentId) => api.delete(`/api/work-items/${id}/comments/${commentId}/`),
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
  listArchive: () => api.get("/api/archive/"),
  reorderWorkspaces: (workspaceIds) => api.post("/api/workspaces/reorder/", { workspace_ids: workspaceIds }),
  listBoards: (slug) => api.get(`/api/workspaces/${slug}/boards/`),
  addBoard: (slug, name) => api.post(`/api/workspaces/${slug}/boards/`, { name }),
  renameBoard: (slug, id, name) => api.patch(`/api/workspaces/${slug}/boards/${id}/`, { name }),
  deleteBoard: (slug, id) => api.delete(`/api/workspaces/${slug}/boards/${id}/`),
  archiveBoard: (slug, id) => api.post(`/api/workspaces/${slug}/boards/${id}/archive/`),
  restoreBoard: (slug, id) => api.post(`/api/workspaces/${slug}/boards/${id}/restore/`),
  reorderBoards: (slug, boardIds) => api.post(`/api/workspaces/${slug}/boards/reorder/`, { board_ids: boardIds }),
  listWorkItems: (params = {}) => api.get("/api/work-items/", { params }),
  getItem: (id) => api.get(`/api/work-items/${id}/`),
  createItem: (payload) => api.post("/api/work-items/", payload),
  updateItem: (id, payload) => api.patch(`/api/work-items/${id}/`, payload),
  archiveItem: (id) => api.post(`/api/work-items/${id}/archive/`),
  restoreItem: (id) => api.post(`/api/work-items/${id}/restore/`),
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
