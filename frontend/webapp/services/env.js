export function getFundIdFromQuery() {
  const q = new URLSearchParams(window.location.search || "");
  return q.get("fundId") || q.get("fund_id") || "";
}

export function getApiBaseUrl() {
  return "/api";
}
