import { apiPost } from "../services/apiClient.js";

function fundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

export function createReportPack(fundId, payload = {}) {
  return apiPost(fundPath(fundId, "/report-packs"), payload);
}

export function generateReportPack(fundId, packId) {
  return apiPost(fundPath(fundId, `/report-packs/${encodeURIComponent(packId)}/generate`), {});
}

export function publishReportPack(fundId, packId) {
  return apiPost(fundPath(fundId, `/report-packs/${encodeURIComponent(packId)}/publish`), {});
}
