import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson, postForm } from "../services/http.js";

export function listTransactions(fundId, params = {}) {
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/transactions`;
  if (params.status) {
    url += `?status=${encodeURIComponent(params.status)}`;
  }
  return fetchJson(url, { method: "GET" });
}

export function createTransaction(fundId, payload) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/transactions`;
  return postJson(url, payload);
}

export function submitForSignature(fundId, txId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/transactions/${encodeURIComponent(txId)}/submit-signature`;
  return fetchJson(url, { method: "PATCH" });
}

export function uploadStatement(fundId, params) {
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

  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/cash/statements/upload`;
  const form = new FormData();
  form.append("period_start", params.period_start);
  form.append("period_end", params.period_end);
  if (params.notes) form.append("notes", String(params.notes));
  form.append("file", file, fileName);
  return postForm(url, form);
}
sap.ui.define([
  "netz/fund/os/services/api"
], function (api) {
  "use strict";

  function assertOk(res, url) {
    if (res.ok) {
      return;
    }
    var err = new Error("HTTP " + res.status + " " + res.statusText + " for " + url);
    err.status = res.status;
    throw err;
  }

  function getJson(url) {
    return fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    }).then(function (res) {
      assertOk(res, url);
      return res.json();
    });
  }

  function postJson(url, payload) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    }).then(function (res) {
      assertOk(res, url);
      return res.json();
    });
  }

  function postForm(url, form) {
    return fetch(url, {
      method: "POST",
      body: form
    }).then(function (res) {
      assertOk(res, url);
      return res.json();
    });
  }

  function listTransactions(fundId, params) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/cash/transactions";

    if (params && params.status) {
      url += "?status=" + encodeURIComponent(params.status);
    }

    return getJson(url);
  }

  function listStatements(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/cash/statements";
    return getJson(url);
  }

  function listStatementLines(fundId, statementId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/cash/statements/" + encodeURIComponent(statementId) + "/lines";
    return getJson(url);
  }

  function manualMatch(fundId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/cash/reconciliation/match";
    return postJson(url, payload);
  }

  function uploadStatement(fundId, params) {
    if (!params || !params.file) {
      return Promise.reject(new Error("Missing required file"));
    }
    if (!params.period_start || !params.period_end) {
      return Promise.reject(new Error("period_start and period_end are required"));
    }

    var file = params.file;
    var fileName = (file && file.name) ? String(file.name) : "statement";
    var lower = fileName.toLowerCase();
    var allowed = [".pdf", ".csv", ".xls", ".xlsx"];
    var ok = allowed.some(function (ext) { return lower.endsWith(ext); });
    if (!ok) {
      return Promise.reject(new Error("Only PDF/CSV/XLS/XLSX files are allowed"));
    }

    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/cash/statements/upload";

    var form = new FormData();
    form.append("period_start", params.period_start);
    form.append("period_end", params.period_end);
    if (params.notes) {
      form.append("notes", String(params.notes));
    }
    form.append("file", file, fileName);

    return postForm(url, form);
  }

  return {
    listTransactions: listTransactions,
    listStatements: listStatements,
    listStatementLines: listStatementLines,
    manualMatch: manualMatch,
    uploadStatement: uploadStatement
  };
});
