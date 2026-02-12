import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson } from "../services/http.js";

export function retrieve(fundId, payload) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/retrieve`;
  return postJson(url, payload);
}

export function answer(fundId, payload) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/answer`;
  return postJson(url, payload);
}

export function getAIActivity(fundId, params = {}) {
  const qs = [];
  if (params.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params.offset != null) qs.push(`offset=${encodeURIComponent(String(params.offset))}`);
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/activity`;
  if (qs.length) url += `?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}
