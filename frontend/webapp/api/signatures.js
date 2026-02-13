import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson } from "../services/http.js";

export function listSignatureRequests(fundId, params = {}) {
  const qs = [];
  if (params.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params.offset != null) qs.push(`offset=${encodeURIComponent(String(params.offset))}`);
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/signatures`;
  if (qs.length) url += `?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}

export function getSignatureRequest(fundId, requestId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/signatures/${encodeURIComponent(requestId)}`;
  return fetchJson(url, { method: "GET" });
}

export function signSignatureRequest(fundId, requestId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/signatures/${encodeURIComponent(requestId)}/sign`;
  return postJson(url, payload);
}

export function rejectSignatureRequest(fundId, requestId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/signatures/${encodeURIComponent(requestId)}/reject`;
  return postJson(url, payload);
}

export function exportExecutionPack(fundId, requestId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/signatures/${encodeURIComponent(requestId)}/execution-pack`;
  return postJson(url, {});
}
