import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson } from "../services/http.js";

export function getComplianceSnapshot(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/compliance/snapshot`;
  return fetchJson(url, { method: "GET" });
}

export function getCashSnapshot(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/snapshot`;
  return fetchJson(url, { method: "GET" });
}

export function exportEvidencePack(fundId, payload) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/evidence-pack`;
  return postJson(url, payload ?? {});
}

export function listNavSnapshots(fundId, params = {}) {
  const qs = [];
  if (params.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params.offset != null) qs.push(`offset=${encodeURIComponent(String(params.offset))}`);
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/nav/snapshots`;
  if (qs.length) url += `?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}

export function createNavSnapshot(fundId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/nav/snapshots`;
  return postJson(url, payload);
}

export function getNavSnapshotById(fundId, snapshotId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/nav/snapshots/${encodeURIComponent(snapshotId)}`;
  return fetchJson(url, { method: "GET" });
}

export function finalizeNavSnapshot(fundId, snapshotId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/nav/snapshots/${encodeURIComponent(snapshotId)}/finalize`;
  return postJson(url, {});
}

export function publishNavSnapshot(fundId, snapshotId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/nav/snapshots/${encodeURIComponent(snapshotId)}/publish`;
  return postJson(url, {});
}

export function recordAssetValuationSnapshot(fundId, snapshotId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/nav/snapshots/${encodeURIComponent(snapshotId)}/assets`;
  return postJson(url, payload);
}

export function listNavSnapshotAssets(fundId, snapshotId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/nav/snapshots/${encodeURIComponent(snapshotId)}/assets`;
  return fetchJson(url, { method: "GET" });
}

export function generateMonthlyPack(fundId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/monthly-pack/generate`;
  return postJson(url, payload);
}

export function listMonthlyPacks(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/monthly-pack/list`;
  return fetchJson(url, { method: "GET" });
}

export function downloadMonthlyPack(fundId, packId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/monthly-pack/${encodeURIComponent(packId)}/download`;
  return fetchJson(url, { method: "GET" });
}

export function generateInvestorStatement(fundId, payload = {}) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/investor-statements/generate`;
  return postJson(url, payload);
}

export function listInvestorStatements(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/investor-statements`;
  return fetchJson(url, { method: "GET" });
}

export function downloadInvestorStatement(fundId, statementId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/investor-statements/${encodeURIComponent(statementId)}/download`;
  return fetchJson(url, { method: "GET" });
}

export function getReportingArchive(fundId, params = {}) {
  const qs = [];
  if (params.period_month) qs.push(`period_month=${encodeURIComponent(String(params.period_month))}`);
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/reports/archive`;
  if (qs.length) url += `?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}
