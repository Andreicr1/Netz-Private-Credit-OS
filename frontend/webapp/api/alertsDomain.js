import { apiGet } from "../services/apiClient.js";

function fundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

export function listDomainAlerts(fundId) {
  return apiGet(fundPath(fundId, "/alerts"));
}
