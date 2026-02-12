import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson, postForm } from "../services/http.js";

export function listDocuments(fundId, params = {}) {
  const qs = [];
  if (params.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params.offset != null) qs.push(`offset=${encodeURIComponent(String(params.offset))}`);
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/documents`;
  if (qs.length) url += `?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}

export function listRootFolders(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/documents/root-folders`;
  return fetchJson(url, { method: "GET" });
}

export function createRootFolder(fundId, name) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/documents/root-folders`;
  return postJson(url, { name });
}

export function uploadPdf(fundId, params) {
  if (!params?.file) return Promise.reject(new Error("Missing required file"));
  const file = params.file;
  const fileName = file?.name ? String(file.name) : "";
  const isPdfByName = fileName.toLowerCase().endsWith(".pdf");
  const isPdfByType = file?.type ? String(file.type).toLowerCase() === "application/pdf" : false;
  if (!isPdfByName && !isPdfByType) return Promise.reject(new Error("Only PDF files are allowed"));

  if (!params.root_folder) return Promise.reject(new Error("Missing required root_folder"));
  if (!params.domain) return Promise.reject(new Error("Missing required domain"));

  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/documents/upload`;
  const form = new FormData();
  form.append("root_folder", params.root_folder);
  form.append("subfolder_path", params.subfolder_path || "");
  form.append("domain", params.domain);
  form.append("title", params.title || "");
  form.append("file", file, fileName || "document.pdf");
  return postForm(url, form);
}
