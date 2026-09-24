import api from "./index";
export const awarenessApi = {
  home: () => api.get('/api/home/', { params: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
  notifications: (before) => api.get('/api/notifications/', { params: before ? { before } : {} }),
  read: (id) => api.post(`/api/notifications/${id}/read/`),
  readAll: () => api.post('/api/notifications/read-all/'),
};
