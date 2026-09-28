import api from "./index";

export const searchApi = {
  search: (query, signal) => api.get("/api/search/", { params: { q: query }, signal }),
};
