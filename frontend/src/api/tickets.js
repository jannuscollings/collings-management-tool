import api from "./index";

export const ticketsApi = {
  list: () => api.get("/api/tickets/"),
  create: (payload) => api.post("/api/tickets/", payload),
  update: (id, payload) => api.patch(`/api/tickets/${id}/`, payload),
  remove: (id) => api.delete(`/api/tickets/${id}/`),
};

export const STATUS_OPTIONS = [
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["closed", "Closed"],
];

export const PRIORITY_OPTIONS = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
];
