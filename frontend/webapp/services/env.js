const DEFAULT_FUND_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_DEV_ACTOR = {
  actor_id: "netz-frontend-dev",
  roles: ["ADMIN"],
  fund_ids: ["*"],
};

function isLocalhost() {
  const host = (window.location && window.location.hostname) || "";
  return host === "localhost" || host === "127.0.0.1";
}

export function getFundIdFromQuery() {
  const q = new URLSearchParams(window.location.search || "");
  const raw = q.get("fundId") || q.get("fund_id") || "";
  const normalized = String(raw).trim();
  return normalized || DEFAULT_FUND_ID;
}

/**
 * Always returns a relative base URL so every call flows through the
 * Azure Static Web Apps linked-backend proxy.  Never use an absolute
 * URL here — direct browser-to-APIM calls are prohibited.
 */
export function getApiBaseUrl() {
  return "/api";
}

export function getDevActorHeaderValue() {
  if (!isLocalhost()) {
    return null;
  }
  return JSON.stringify(DEFAULT_DEV_ACTOR);
}
