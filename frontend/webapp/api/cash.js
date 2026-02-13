import { apiGet, apiPatch, apiPost, apiPostForm } from "../services/apiClient.js";

function cashPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}/cash${suffix}`;
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

export async function getCashSnapshot(fundId) {
  return apiGet(cashPath(fundId, "/snapshot"));
}

export async function listCashTransactions(fundId, params = {}) {
  return apiGet(withQuery(cashPath(fundId, "/transactions"), params));
}

export async function getCashTransactionDetail(fundId, transactionId) {
  return apiGet(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}`));
}

export async function createCashTransaction(fundId, payload) {
  return apiPost(cashPath(fundId, "/transactions"), payload ?? {});
}

export async function submitCashTransaction(fundId, transactionId) {
  return apiPost(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/submit`), {});
}

export async function submitCashTransactionForSignature(fundId, transactionId) {
  return apiPatch(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/submit-signature`), {});
}

export async function approveCashTransactionDirector(fundId, transactionId, payload) {
  return apiPost(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/approve/director`), payload ?? {});
}

export async function approveCashTransactionIc(fundId, transactionId, payload) {
  return apiPost(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/approve/ic`), payload ?? {});
}

export async function approveCashTransaction(fundId, transactionId, payload) {
  return apiPost(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/approve`), payload ?? {});
}

export async function rejectCashTransaction(fundId, transactionId, payload) {
  return apiPost(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/reject`), payload ?? {});
}

export async function markCashTransactionSent(fundId, transactionId, payload) {
  return apiPost(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/mark-sent`), payload ?? {});
}

export async function markCashTransactionExecutedPatch(fundId, transactionId, payload) {
  return apiPatch(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/mark-executed`), payload ?? {});
}

export async function markCashTransactionExecutedPost(fundId, transactionId, payload) {
  return apiPost(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/mark-executed`), payload ?? {});
}

export async function markCashTransactionReconciled(fundId, transactionId) {
  return apiPatch(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/mark-reconciled`), {});
}

export async function generateCashInstructions(fundId, transactionId) {
  return apiPost(cashPath(fundId, `/transactions/${encodeURIComponent(transactionId)}/generate-instructions`), {});
}

export async function uploadCashStatement(fundId, params) {
  if (!params?.file) return Promise.reject(new Error("Missing required file"));
  if (!params.period_start || !params.period_end) {
    return Promise.reject(new Error("period_start and period_end are required"));
  }

  const file = params.file;
  const fileName = file?.name ? String(file.name) : "statement";
  const lower = fileName.toLowerCase();
  const allowed = [".pdf", ".csv", ".xls", ".xlsx"];
  if (!allowed.some((ext) => lower.endsWith(ext))) {
    return Promise.reject(new Error("Only PDF/CSV/XLS/XLSX files are allowed"));
  }

  const form = new FormData();
  form.append("period_start", params.period_start);
  form.append("period_end", params.period_end);
  if (params.notes) form.append("notes", String(params.notes));
  form.append("file", file, fileName);
  return apiPostForm(cashPath(fundId, "/statements/upload"), form);
}

export async function listCashStatements(fundId) {
  return apiGet(cashPath(fundId, "/statements"));
}

export async function listCashStatementLines(fundId, statementId) {
  return apiGet(cashPath(fundId, `/statements/${encodeURIComponent(statementId)}/lines`));
}

export async function addCashStatementLine(fundId, statementId, payload) {
  return apiPost(cashPath(fundId, `/statements/${encodeURIComponent(statementId)}/lines`), payload ?? {});
}

export async function listCashUnmatchedReconciliationLines(fundId, params = {}) {
  return apiGet(withQuery(cashPath(fundId, "/reconciliation/unmatched"), params));
}

export async function runCashReconciliation(fundId, payload) {
  return apiPost(cashPath(fundId, "/reconcile"), payload ?? {});
}

export async function getCashReconciliationReport(fundId) {
  return apiGet(cashPath(fundId, "/reconciliation/report"));
}

export async function matchCashReconciliationLine(fundId, payload) {
  return apiPost(cashPath(fundId, "/reconciliation/match"), payload ?? {});
}

export const markCashTransactionExecuted = markCashTransactionExecutedPatch;

export const listTransactions = listCashTransactions;
export const createTransaction = createCashTransaction;
export const submitForSignature = submitCashTransactionForSignature;
export const uploadStatement = uploadCashStatement;
export const listStatements = listCashStatements;
export const listStatementLines = listCashStatementLines;
export const manualMatch = matchCashReconciliationLine;
