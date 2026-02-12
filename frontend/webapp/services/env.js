const DEFAULT_FUND_ID = "001";

export function getFundIdFromQuery() {
  const q = new URLSearchParams(window.location.search || "");
  const raw = q.get("fundId") || q.get("fund_id") || "";
  const normalized = String(raw).trim();
  return normalized || DEFAULT_FUND_ID;
}

export function getApiBaseUrl() {
  return "/api";
}
