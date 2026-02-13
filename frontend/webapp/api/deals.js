import { apiGet, apiPatch, apiPost } from "../services/apiClient.js";

function encodeFundPath(fundId, suffix) {
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

export async function listPipelineDeals(fundId, params = {}) {
  const path = withQuery(encodeFundPath(fundId, "/pipeline/deals"), params);
  return apiGet(path);
}

export async function createPipelineDeal(fundId, payload) {
  const path = encodeFundPath(fundId, "/pipeline/deals");
  return apiPost(path, payload ?? {});
}

export async function updatePipelineDealStage(fundId, dealId, payload) {
  const path = encodeFundPath(fundId, `/pipeline/deals/${encodeURIComponent(dealId)}/stage`);
  return apiPatch(path, payload ?? {});
}

export async function createPipelineDealDecision(fundId, dealId, payload) {
  const path = encodeFundPath(fundId, `/pipeline/deals/${encodeURIComponent(dealId)}/decisions`);
  return apiPost(path, payload ?? {});
}

export async function runPipelineQualification(fundId, payload) {
  const path = encodeFundPath(fundId, "/pipeline/deals/qualification/run");
  return apiPost(path, payload ?? {});
}

export async function listDeals(fundId) {
  const path = encodeFundPath(fundId, "/deals");
  return apiGet(path);
}

export async function createDeal(fundId, payload) {
  const path = encodeFundPath(fundId, "/deals");
  return apiPost(path, payload ?? {});
}

export async function updateDealDecision(fundId, dealId, payload) {
  const path = encodeFundPath(fundId, `/deals/${encodeURIComponent(dealId)}/decision`);
  return apiPatch(path, payload ?? {});
}

export const decideDeal = updateDealDecision;

export async function convertDealToAsset(fundId, dealId) {
  const path = encodeFundPath(fundId, `/deals/${encodeURIComponent(dealId)}/convert`);
  return apiPost(path, {});
}

export async function createDealIcMemo(fundId, dealId, payload) {
  const path = encodeFundPath(fundId, `/deals/${encodeURIComponent(dealId)}/ic-memo`);
  return apiPost(path, payload ?? {});
}
