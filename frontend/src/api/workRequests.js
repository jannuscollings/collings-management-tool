import api from "./index";

export const workRequestsApi = {
  list: (params = {}) => api.get("/api/requests/", { params }),
  get: (id) => api.get(`/api/requests/${id}/`),
  create: (payload) => api.post("/api/requests/", payload),
  update: (id, payload) => api.patch(`/api/requests/${id}/`, payload),
  triage: (id, payload) => api.post(`/api/requests/${id}/triage/`, payload),
  accept: (id) => api.post(`/api/requests/${id}/accept/`),
  reject: (id) => api.post(`/api/requests/${id}/reject/`),
};

export const REQUEST_TYPE_OPTIONS = [["creative_design", "Creative & Design"]];

export const REQUEST_PRIORITY_OPTIONS = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
];

