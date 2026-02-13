import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson } from "../services/http.js";

export function listAIActivity(fundId, params = {}) {
  const qs = [];
  if (params.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params.offset != null) qs.push(`offset=${encodeURIComponent(String(params.offset))}`);
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/activity`;
  if (qs.length) url += `?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}

export function createAIQuery(fundId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/query`;
  return postJson(url, payload);
}

export function listAIHistory(fundId, params = {}) {
  const qs = [];
  if (params.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params.offset != null) qs.push(`offset=${encodeURIComponent(String(params.offset))}`);
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/history`;
  if (qs.length) url += `?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}

export function retrieveAIContext(fundId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/retrieve`;
  return postJson(url, payload);
}

export function answerAIQuestion(fundId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/answer`;
  return postJson(url, payload);
}
