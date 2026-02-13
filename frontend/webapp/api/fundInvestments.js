import { apiGet, apiPost } from "../services/apiClient.js";

function fundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

export function createFundInvestment(fundId, assetId, payload = {}) {
  return apiPost(fundPath(fundId, `/assets/${encodeURIComponent(assetId)}/fund-investment`), payload);
}

export function getFundInvestment(fundId, assetId) {
  return apiGet(fundPath(fundId, `/assets/${encodeURIComponent(assetId)}/fund-investment`));
}
