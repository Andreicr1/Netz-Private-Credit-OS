import { apiPost } from "../services/apiClient.js";

function fundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

export function createAsset(fundId, payload = {}) {
  return apiPost(fundPath(fundId, "/assets"), payload);
}
