import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson, postForm } from "../services/http.js";

export function listTransactions(fundId, params = {}) {
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/transactions`;
  if (params.status) {
    url += `?status=${encodeURIComponent(params.status)}`;
  }
  return fetchJson(url, { method: "GET" });
}

export function createTransaction(fundId, payload) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/transactions`;
  return postJson(url, payload);
}

export function submitForSignature(fundId, txId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/transactions/${encodeURIComponent(txId)}/submit-signature`;
  return fetchJson(url, { method: "PATCH" });
}

export function uploadStatement(fundId, params) {
  if (!params?.file) return Promise.reject(new Error("Missing required file"));
  if (!params.period_start || !params.period_end) {
    return Promise.reject(new Error("period_start and period_end are required"));
  }

  const file = params.file;
  const fileName = file?.name ? String(file.name) : "statement";
  const lower = fileName.toLowerCase();
  const allowed = [".pdf", ".csv", ".xls", ".xlsx"];
  if (!allowed.some((ext) => lower.endsWith(ext))) {
    return Promise.reject(new Error("Only PDF/CSV/XLS/XLSX files are allowed"));
  }

  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/statements/upload`;
  const form = new FormData();
  form.append("period_start", params.period_start);
  form.append("period_end", params.period_end);
  if (params.notes) form.append("notes", String(params.notes));
  form.append("file", file, fileName);
  return postForm(url, form);
}
