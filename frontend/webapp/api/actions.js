import { apiGet, apiPatch, apiPost } from "../services/apiClient.js";

function fundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

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

export async function listExecutionActions(fundId, params = {}) {
  return apiGet(withQuery(fundPath(fundId, "/execution/actions"), params));
}

export async function createExecutionAction(fundId, payload) {
  return apiPost(fundPath(fundId, "/execution/actions"), payload ?? {});
}

export async function updateExecutionActionStatus(fundId, actionId, payload) {
  return apiPatch(fundPath(fundId, `/execution/actions/${encodeURIComponent(actionId)}/status`), payload ?? {});
}

export async function attachExecutionActionEvidence(fundId, actionId, payload) {
  return apiPost(fundPath(fundId, `/execution/actions/${encodeURIComponent(actionId)}/evidence`), payload ?? {});
}

export async function listGovernedActions(fundId) {
  return apiGet(fundPath(fundId, "/actions"));
}

export async function createGovernedAction(fundId, payload) {
  return apiPost(fundPath(fundId, "/actions"), payload ?? {});
}

export async function updateGovernedActionStatus(fundId, actionId, payload) {
  return apiPatch(fundPath(fundId, `/actions/${encodeURIComponent(actionId)}`), payload ?? {});
}
