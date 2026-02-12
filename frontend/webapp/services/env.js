const DEFAULT_FUND_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_DEV_ACTOR = {
  actor_id: "netz-frontend-dev",
  roles: ["ADMIN"],
  fund_ids: ["*"],
};

export function getFundIdFromQuery() {
  const q = new URLSearchParams(window.location.search || "");
  const raw = q.get("fundId") || q.get("fund_id") || "";
  const normalized = String(raw).trim();
  return normalized || DEFAULT_FUND_ID;
}

export function getApiBaseUrl() {
  return "/api";
}

export function getDevActorHeaderValue() {
  return JSON.stringify(DEFAULT_DEV_ACTOR);
}
