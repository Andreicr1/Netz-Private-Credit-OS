import { apiGet, apiPost } from "../services/apiClient.js";

function encodeFundPath(fundId, suffix) {
  return `/funds/${encodeURIComponent(fundId)}${suffix}`;
}

function withPageParams(path, params = {}) {
  const query = new URLSearchParams();
  if (params.limit !== undefined && params.limit !== null) {
    query.set("limit", String(params.limit));
  }
  if (params.offset !== undefined && params.offset !== null) {
    query.set("offset", String(params.offset));
  }
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export async function listBorrowers(fundId, params = {}) {
  const path = withPageParams(encodeFundPath(fundId, "/portfolio/borrowers"), params);
  return apiGet(path);
}

export async function createBorrower(fundId, payload) {
  const path = encodeFundPath(fundId, "/portfolio/borrowers");
  return apiPost(path, payload ?? {});
}

export async function listLoans(fundId, params = {}) {
  const path = withPageParams(encodeFundPath(fundId, "/portfolio/loans"), params);
  return apiGet(path);
}

export async function createLoan(fundId, payload) {
  const path = encodeFundPath(fundId, "/portfolio/loans");
  return apiPost(path, payload ?? {});
}

export async function listCovenants(fundId, params = {}) {
  const path = withPageParams(encodeFundPath(fundId, "/portfolio/covenants"), params);
  return apiGet(path);
}

export async function createCovenant(fundId, payload) {
  const path = encodeFundPath(fundId, "/portfolio/covenants");
  return apiPost(path, payload ?? {});
}

export async function createCovenantTest(fundId, payload) {
  const path = encodeFundPath(fundId, "/portfolio/covenant-tests");
  return apiPost(path, payload ?? {});
}

export async function listBreaches(fundId, params = {}) {
  const path = withPageParams(encodeFundPath(fundId, "/portfolio/breaches"), params);
  return apiGet(path);
}

export async function listAlerts(fundId, params = {}) {
  const path = withPageParams(encodeFundPath(fundId, "/portfolio/alerts"), params);
  return apiGet(path);
}

export async function createAlert(fundId, payload) {
  const path = encodeFundPath(fundId, "/portfolio/alerts");
  return apiPost(path, payload ?? {});
}
