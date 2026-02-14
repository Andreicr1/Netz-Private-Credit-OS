import { apiGet } from "../services/apiClient.js";

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

export function getPlatformHealth() {
  return apiGet("/health");
}

export function getAzureHealth() {
  return apiGet("/health/azure");
}

export function listAdminAuditEvents(fundId, params = {}) {
  return apiGet(withQuery(`/funds/${encodeURIComponent(fundId)}/execution/actions`, params));
}

export function listGovernedAuditEvents(fundId) {
  return apiGet(`/funds/${encodeURIComponent(fundId)}/actions`);
}
