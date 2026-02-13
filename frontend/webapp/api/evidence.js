import { apiPatch, apiPost } from "../services/apiClient.js";

function fundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

export function createEvidenceUploadRequest(fundId, payload = {}) {
  return apiPost(fundPath(fundId, "/evidence/upload-request"), payload);
}

export function completeEvidence(fundId, evidenceId, payload = {}) {
  return apiPatch(fundPath(fundId, `/evidence/${encodeURIComponent(evidenceId)}/complete`), payload);
}
