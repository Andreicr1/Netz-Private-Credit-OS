import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPostForm,
  buildHttpError as buildClientHttpError,
  toApiPathFromUrl,
} from "./apiClient.js";

function parseJsonBody(input) {
  if (typeof input === "undefined" || input === null || input === "") {
    return {};
  }
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return { raw: input };
    }
  }
  return input;
}

export function buildHttpError(res, url, detailText) {
  return buildClientHttpError(res.status, res.statusText, url, detailText);
}

export async function fetchJson(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const path = toApiPathFromUrl(url);

  if (method === "GET") {
    return apiGet(path);
  }
  if (method === "POST") {
    return apiPost(path, parseJsonBody(options.body));
  }
  if (method === "PATCH") {
    return apiPatch(path, parseJsonBody(options.body));
  }
  if (method === "DELETE") {
    return apiDelete(path, parseJsonBody(options.body));
  }

  throw new Error(`Unsupported HTTP method in fetchJson: ${method}`);
}

export function postJson(url, payload) {
  const path = toApiPathFromUrl(url);
  return apiPost(path, payload ?? {});
}

export function postForm(url, formData) {
  const path = toApiPathFromUrl(url);
  return apiPostForm(path, formData);
}

export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
