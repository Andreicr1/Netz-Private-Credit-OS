export function toJsonSafe(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify({ error: "Failed to serialize" }, null, 2);
  }
}

export function downloadJson(filename, obj) {
  const blob = new Blob([toJsonSafe(obj)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildHttpError(res, url, detailText) {
  const err = new Error(`HTTP ${res.status} ${res.statusText} for ${url}${detailText ? ` — ${detailText}` : ""}`);
  err.status = res.status;
  err.url = url;
  err.detail = detailText;
  return err;
}

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });
}

export async function postForm(url, formData) {
  const res = await fetch(url, {
    method: "POST",
    body: formData,
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
