const DEFAULT_FUND_ID = "00000000-0000-0000-0000-000000000001";
const APIM_BASE_URL = "https://netz-prod-api-apim.azure-api.net/api";
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

export function getApiBaseUrl() {
  return isLocalhost() ? "/api" : APIM_BASE_URL;
}

export function getDevActorHeaderValue() {
  if (!isLocalhost()) {
    return null;
  }
  return JSON.stringify(DEFAULT_DEV_ACTOR);
}
