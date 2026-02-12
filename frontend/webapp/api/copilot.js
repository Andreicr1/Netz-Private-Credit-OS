import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson } from "../services/http.js";

export function retrieve(fundId, payload) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/retrieve`;
  return postJson(url, payload);
}

export function answer(fundId, payload) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/answer`;
  return postJson(url, payload);
}

export function getAIActivity(fundId, params = {}) {
  const qs = [];
  if (params.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params.offset != null) qs.push(`offset=${encodeURIComponent(String(params.offset))}`);
  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/ai/activity`;
  if (qs.length) url += `?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}
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

  function retrieve(fundId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/ai/retrieve";
    return postJson(url, payload);
  }

  function answer(fundId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/ai/answer";
    return postJson(url, payload);
  }

  function exportEvidencePack(fundId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/evidence-pack";
    return postJson(url, payload || {});
  }

  function listHistoryQuestions(fundId, params) {
    // Optional endpoint. Not currently exposed by backend in this repo.
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/ai/questions";
    if (params && typeof params.limit !== "undefined") {
      url += "?limit=" + encodeURIComponent(String(params.limit));
    }
    return fetchJson(url, { method: "GET", headers: { "Accept": "application/json" } });
  }

  return {
    retrieve: retrieve,
    answer: answer,
    exportEvidencePack: exportEvidencePack,
    listHistoryQuestions: listHistoryQuestions
  };
});
