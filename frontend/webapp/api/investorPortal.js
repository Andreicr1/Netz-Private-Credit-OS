import { apiGet } from "../services/apiClient.js";

function fundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

export function listInvestorReportPacks(fundId) {
  return apiGet(fundPath(fundId, "/investor/report-packs"));
}
