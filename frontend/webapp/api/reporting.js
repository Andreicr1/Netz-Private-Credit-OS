import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson } from "../services/http.js";

export function getComplianceSnapshot(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/compliance/snapshot`;
  return fetchJson(url, { method: "GET" });
}

export function getCashSnapshot(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/snapshot`;
  return fetchJson(url, { method: "GET" });
}

export function exportEvidencePack(fundId, payload) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/evidence-pack`;
  return postJson(url, payload ?? {});
}
