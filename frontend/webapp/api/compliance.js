import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson } from "../services/http.js";

export function me(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/compliance/me`;
  return fetchJson(url, { method: "GET" });
}

export function listObligations(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/compliance/obligations`;
  return fetchJson(url, { method: "GET" });
}

export function closeObligation(fundId, obligationId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/compliance/obligations/${encodeURIComponent(obligationId)}/workflow/close`;
  return postJson(url, {});
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

  function listObligations(fundId, params) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/obligations";

    if (params && params.view) {
      url += "?view=" + encodeURIComponent(params.view);
    }

    return getJson(url);
  }

  function createObligation(fundId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/obligations";
    return postJson(url, payload);
  }

  function getObligation(fundId, obligationId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/obligations/" + encodeURIComponent(obligationId);
    return getJson(url);
  }

  function listEvidence(fundId, obligationId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/obligations/" + encodeURIComponent(obligationId) + "/evidence";
    return getJson(url);
  }

  function linkEvidence(fundId, obligationId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/obligations/" + encodeURIComponent(obligationId) + "/evidence/link";
    return postJson(url, payload);
  }

  function markInProgress(fundId, obligationId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/obligations/" + encodeURIComponent(obligationId) + "/workflow/mark-in-progress";
    return postJson(url, {});
  }

  function closeObligation(fundId, obligationId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/obligations/" + encodeURIComponent(obligationId) + "/workflow/close";
    return postJson(url, {});
  }

  function listGaps(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/gaps";
    return getJson(url);
  }

  function recomputeGaps(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/gaps/recompute";
    return postJson(url, {});
  }

  function listAudit(fundId, obligationId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/obligations/" + encodeURIComponent(obligationId) + "/audit";
    return getJson(url);
  }

  function me(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/me";
    return getJson(url);
  }

  return {
    me: me,
    listObligations: listObligations,
    createObligation: createObligation,
    getObligation: getObligation,
    listEvidence: listEvidence,
    linkEvidence: linkEvidence,
    markInProgress: markInProgress,
    closeObligation: closeObligation,
    listGaps: listGaps,
    recomputeGaps: recomputeGaps,
    listAudit: listAudit
  };
});
