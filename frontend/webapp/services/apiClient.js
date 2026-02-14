import { getApiBaseUrl, getDevActorHeaderValue } from "./env.js";

const API_BASE = getApiBaseUrl();
let cachedPrincipalHeadersPromise = null;

function isStaticWebAppsHost() {
  try {
    const host = (window.location && window.location.hostname) || "";
    return host.includes("azurestaticapps.net");
  } catch {
    return false;
  }
}

function getClientPrincipal(payload) {
  if (Array.isArray(payload)) {
    if (payload.length === 0) return null;
    return payload[0] && payload[0].clientPrincipal ? payload[0].clientPrincipal : null;
  }
  return payload && payload.clientPrincipal ? payload.clientPrincipal : null;
}

export function buildHttpError(status, statusText, url, detailText) {
  const err = new Error(`HTTP ${status} ${statusText} for ${url}${detailText ? ` — ${detailText}` : ""}`);
  err.status = status;
  err.url = url;
  err.detail = detailText;
  return err;
}

async function getSwaClientPrincipalHeaders() {
  if (!isStaticWebAppsHost()) {
    return {};
  }

  if (!cachedPrincipalHeadersPromise) {
    cachedPrincipalHeadersPromise = fetch("/.auth/me", { method: "GET", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          return {};
        }
        const payload = await res.json();
        const principal = getClientPrincipal(payload);
        if (!principal) {
          return {};
        }
        const headers = {};
        if (principal.userId) {
          headers["X-NETZ-PRINCIPAL-ID"] = String(principal.userId);
        }
        if (principal.userDetails) {
          headers["X-NETZ-PRINCIPAL-NAME"] = String(principal.userDetails);
        }
        return headers;
      })
      .catch(() => ({}));
  }

  return cachedPrincipalHeadersPromise;
}

function normalizeApiPath(path) {
  const raw = String(path || "").trim();
  if (!raw) {
    return API_BASE;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return toApiPathFromUrl(raw);
  }
  if (raw.startsWith(`${API_BASE}/`) || raw === API_BASE) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return `${API_BASE}${raw}`;
  }
  return `${API_BASE}/${raw}`;
}

function parseBodyByContentType(text, contentType) {
  if (!text) return null;
  if (String(contentType || "").toLowerCase().includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function request(method, path, body, options = {}) {
  const url = normalizeApiPath(path);
  const devActor = getDevActorHeaderValue();
  const principalHeaders = await getSwaClientPrincipalHeaders();
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers = {
    Accept: "application/json",
    ...(devActor ? { "X-DEV-ACTOR": devActor } : {}),
    ...(principalHeaders || {}),
    ...(options.headers || {}),
  };

  if (!isFormData && method !== "GET" && method !== "DELETE" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    credentials: options.credentials || "include",
    body: isFormData
      ? body
      : (method === "GET" || method === "DELETE")
        ? undefined
        : JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  const parsed = parseBodyByContentType(text, res.headers.get("content-type"));

  if (!res.ok) {
    const detail = parsed && (parsed.detail || parsed.message) ? String(parsed.detail || parsed.message) : null;
    throw buildHttpError(res.status, res.statusText, url, detail);
  }

  return parsed;
}

export function toApiPathFromUrl(url) {
  const resolved = new URL(String(url), window.location.origin);
  if (resolved.origin !== window.location.origin) {
    throw new Error(`Cross-origin URL is not allowed in frontend API client: ${url}`);
  }
  return `${resolved.pathname}${resolved.search}`;
}

export async function apiGet(path) {
  return request("GET", path);
}

export async function apiPost(path, body) {
  return request("POST", path, body);
}

export async function apiPatch(path, body) {
  return request("PATCH", path, body);
}

export async function apiDelete(path, body) {
  return request("DELETE", path, body);
}

export async function apiPostForm(path, formData) {
  return request("POST", path, formData);
}

export async function ensureAuthenticated() {
  if (!isStaticWebAppsHost()) {
    return true;
  }

  try {
    const principalHeaders = await getSwaClientPrincipalHeaders();
    if (principalHeaders && principalHeaders["X-NETZ-PRINCIPAL-ID"]) {
      return true;
    }
  } catch {
    // SWA principal not available — fall through
  }

  // If /.auth/login/aad is available, redirect to it.
  // Otherwise (AAD not registered on SWA yet), allow access — the backend
  // AUTHZ_BYPASS_ENABLED flag handles authorization in the interim.
  try {
    const probe = await fetch("/.auth/login/aad", { method: "HEAD", redirect: "manual" });
    if (probe.status !== 404) {
      const currentPath = `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;
      window.location.replace(`/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(currentPath)}`);
      return false;
    }
  } catch {
    // Network error probing auth endpoint — allow access
  }

  return true;
}

const apiClient = {
  API_BASE,
  buildHttpError,
  toApiPathFromUrl,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiPostForm,
  ensureAuthenticated,
};

if (typeof window !== "undefined") {
  window.__NETZ_API_CLIENT__ = apiClient;
}

export default apiClient;
