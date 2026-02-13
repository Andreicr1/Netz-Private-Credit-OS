import { apiGet, apiPost } from "../services/apiClient.js";

function compliancePath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}/compliance${suffix}`;
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function getComplianceSnapshot(fundId) {
  return apiGet(compliancePath(fundId, "/snapshot"));
}

export async function getComplianceMe(fundId) {
  return apiGet(compliancePath(fundId, "/me"));
}

export async function listComplianceObligations(fundId, params = {}) {
  return apiGet(withQuery(compliancePath(fundId, "/obligations"), params));
}

export async function getComplianceObligation(fundId, obligationId) {
  return apiGet(compliancePath(fundId, `/obligations/${encodeURIComponent(obligationId)}`));
}

export async function listComplianceObligationEvidence(fundId, obligationId) {
  return apiGet(compliancePath(fundId, `/obligations/${encodeURIComponent(obligationId)}/evidence`));
}

export async function linkComplianceObligationEvidence(fundId, obligationId, payload) {
  return apiPost(compliancePath(fundId, `/obligations/${encodeURIComponent(obligationId)}/evidence/link`), payload ?? {});
}

export async function markComplianceObligationInProgress(fundId, obligationId) {
  return apiPost(compliancePath(fundId, `/obligations/${encodeURIComponent(obligationId)}/workflow/mark-in-progress`), {});
}

export async function closeComplianceObligation(fundId, obligationId) {
  return apiPost(compliancePath(fundId, `/obligations/${encodeURIComponent(obligationId)}/workflow/close`), {});
}

export async function listComplianceObligationAudit(fundId, obligationId) {
  return apiGet(compliancePath(fundId, `/obligations/${encodeURIComponent(obligationId)}/audit`));
}

export async function createComplianceObligation(fundId, payload) {
  return apiPost(compliancePath(fundId, "/obligations"), payload ?? {});
}

export async function listComplianceObligationStatus(fundId, params = {}) {
  return apiGet(withQuery(compliancePath(fundId, "/obligation-status"), params));
}

export async function recomputeComplianceObligationStatus(fundId) {
  return apiPost(compliancePath(fundId, "/obligation-status/recompute"), {});
}

export async function recomputeComplianceGaps(fundId) {
  return apiPost(compliancePath(fundId, "/gaps/recompute"), {});
}

export async function listComplianceGaps(fundId, params = {}) {
  return apiGet(withQuery(compliancePath(fundId, "/gaps"), params));
}

export const me = getComplianceMe;
export const listObligations = listComplianceObligations;
export const closeObligation = closeComplianceObligation;
