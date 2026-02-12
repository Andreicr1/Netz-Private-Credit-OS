import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson } from "../services/http.js";

export function getSignatureRequest(fundId, requestId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/signatures/${encodeURIComponent(requestId)}`;
  return fetchJson(url, { method: "GET" });
}

export function signRequest(fundId, requestId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/signatures/${encodeURIComponent(requestId)}/sign`;
  return postJson(url, payload);
}

export function rejectRequest(fundId, requestId, reason) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/signatures/${encodeURIComponent(requestId)}/reject`;
  return postJson(url, { reason });
}

export function exportExecutionPack(fundId, requestId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/signatures/${encodeURIComponent(requestId)}/execution-pack`;
  return postJson(url, {});
}
