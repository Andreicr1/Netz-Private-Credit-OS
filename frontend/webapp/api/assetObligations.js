import { apiGet, apiPatch, apiPost } from "../services/apiClient.js";

function fundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

export function createAssetObligation(fundId, assetId, payload = {}) {
  return apiPost(fundPath(fundId, `/assets/${encodeURIComponent(assetId)}/obligations`), payload);
}

export function listAssetObligations(fundId) {
  return apiGet(fundPath(fundId, "/obligations"));
}

export function updateObligation(fundId, obligationId, payload = {}) {
  return apiPatch(fundPath(fundId, `/obligations/${encodeURIComponent(obligationId)}`), payload);
}
