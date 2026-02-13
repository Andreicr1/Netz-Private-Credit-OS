import { apiGet, apiPatch } from "../services/apiClient.js";

function fundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

export function listPortfolioActions(fundId) {
  return apiGet(fundPath(fundId, "/portfolio/actions"));
}

export function updatePortfolioAction(fundId, actionId, payload = {}) {
  return apiPatch(fundPath(fundId, `/portfolio/actions/${encodeURIComponent(actionId)}`), payload);
}
