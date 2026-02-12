import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson } from "../services/http.js";

export function me(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/compliance/me`;
  return fetchJson(url, { method: "GET" });
}

export function listObligations(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/compliance/obligations`;
  return fetchJson(url, { method: "GET" });
}

export function closeObligation(fundId, obligationId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/compliance/obligations/${encodeURIComponent(obligationId)}/workflow/close`;
  return postJson(url, {});
}
