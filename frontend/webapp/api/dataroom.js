import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postForm, postJson } from "../services/http.js";

export function uploadDataroomDocument(params = {}) {
  if (!params.fund_id) return Promise.reject(new Error("Missing required fund_id"));
  if (!params.file) return Promise.reject(new Error("Missing required file"));

  const file = params.file;
  const fileName = file?.name ? String(file.name) : "document";

  const form = new FormData();
  form.append("fund_id", String(params.fund_id));
  form.append("title", params.title || "");
  form.append("file", file, fileName);

  const url = `${getApiBaseUrl()}/dataroom/documents`;
  return postForm(url, form);
}

export function ingestDataroomDocument(documentId, params = {}) {
  if (!documentId) return Promise.reject(new Error("Missing required documentId"));
  if (!params.fund_id) return Promise.reject(new Error("Missing required fund_id"));

  const qs = [`fund_id=${encodeURIComponent(String(params.fund_id))}`];
  if (params.version_number != null) qs.push(`version_number=${encodeURIComponent(String(params.version_number))}`);
  if (params.store_artifacts_in_evidence != null) {
    qs.push(`store_artifacts_in_evidence=${encodeURIComponent(String(Boolean(params.store_artifacts_in_evidence)))}`);
  }

  const url = `${getApiBaseUrl()}/dataroom/documents/${encodeURIComponent(documentId)}/ingest?${qs.join("&")}`;
  return postJson(url, {});
}

export function searchDataroom(params = {}) {
  if (!params.fund_id) return Promise.reject(new Error("Missing required fund_id"));
  if (!params.q) return Promise.reject(new Error("Missing required q"));

  const qs = [
    `fund_id=${encodeURIComponent(String(params.fund_id))}`,
    `q=${encodeURIComponent(String(params.q))}`,
  ];
  if (params.top != null) qs.push(`top=${encodeURIComponent(String(params.top))}`);

  const url = `${getApiBaseUrl()}/dataroom/search?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}

/**
 * Browse dataroom blob container — list folders and files at a prefix.
 * @param {object} params
 * @param {string} [params.prefix] — Virtual folder prefix (e.g. "1 Corporate Documentation/")
 * @returns {Promise<{container: string, prefix: string, count: number, items: Array}>}
 */
export function browseDataroom(params = {}) {
  const qs = [];
  if (params.prefix) qs.push(`prefix=${encodeURIComponent(String(params.prefix))}`);
  const url = `${getApiBaseUrl()}/dataroom/browse${qs.length ? "?" + qs.join("&") : ""}`;
  return fetchJson(url, { method: "GET" });
}
