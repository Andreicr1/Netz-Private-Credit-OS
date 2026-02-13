import { getDevActorHeaderValue } from "./env.js";

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

export function buildHttpError(res, url, detailText) {
  const err = new Error(`HTTP ${res.status} ${res.statusText} for ${url}${detailText ? ` — ${detailText}` : ""}`);
  err.status = res.status;
  err.url = url;
  err.detail = detailText;
  return err;
}

export async function fetchJson(url, options = {}) {
  const devActor = getDevActorHeaderValue();
  const principalHeaders = await getSwaClientPrincipalHeaders();
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(devActor ? { "X-DEV-ACTOR": devActor } : {}),
      ...(principalHeaders || {}),
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!res.ok) {
    const detail = body && (body.detail || body.message) ? (body.detail || body.message) : null;
    throw buildHttpError(res, url, detail ? String(detail) : null);
  }

  return body;
}

export function postJson(url, payload) {
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
}

export async function postForm(url, formData) {
  const devActor = getDevActorHeaderValue();
  const principalHeaders = await getSwaClientPrincipalHeaders();
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers: {
      ...(devActor ? { "X-DEV-ACTOR": devActor } : {}),
      ...(principalHeaders || {}),
    },
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    const detail = body && (body.detail || body.message) ? (body.detail || body.message) : null;
    throw buildHttpError(res, url, detail ? String(detail) : null);
  }
  return body;
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
