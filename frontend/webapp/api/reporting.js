sap.ui.define([
  "netz/fund/os/services/api"
], function (api) {
  "use strict";

  function buildError(status, url, detail) {
    var msg = detail || ("HTTP " + status + " for " + url);
    var err = new Error(msg);
    err.status = status;
    err.url = url;
    err.detail = detail;
    return err;
  }

  function fetchJson(url, options) {
    return fetch(url, options || {}).then(function (res) {
      return res.text().then(function (t) {
        var body = null;
        if (t) {
          try {
            body = JSON.parse(t);
          } catch (e) {
            body = { message: t };
          }
        }

        if (!res.ok) {
          var detail = (body && (body.detail || body.message)) ? (body.detail || body.message) : null;
          throw buildError(res.status, url, detail);
        }

        return body;
      });
    });
  }

  function getJson(url) {
    return fetchJson(url, { method: "GET", headers: { "Accept": "application/json" } });
  }

  function postJson(url, payload) {
    return fetchJson(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
  }

  function getComplianceSnapshot(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/compliance/snapshot";
    return getJson(url);
  }

  function getCashSnapshot(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/cash/snapshot";
    return getJson(url);
  }

  function getAIActivity(fundId, params) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/ai/activity";
    if (params) {
      var qs = [];
      if (typeof params.limit !== "undefined") qs.push("limit=" + encodeURIComponent(String(params.limit)));
      if (typeof params.offset !== "undefined") qs.push("offset=" + encodeURIComponent(String(params.offset)));
      if (qs.length) url += "?" + qs.join("&");
    }
    return getJson(url);
  }

  function exportEvidencePack(fundId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/evidence-pack";
    return postJson(url, payload || {});
  }

  return {
    getComplianceSnapshot: getComplianceSnapshot,
    getCashSnapshot: getCashSnapshot,
    getAIActivity: getAIActivity,
    exportEvidencePack: exportEvidencePack
  };
});
