sap.ui.define([], function () {
  "use strict";

  // Azure Static Web Apps proxies '/api/*' to the linked backend.
  // Using a relative base avoids CORS and keeps environments consistent.
  var BASE_URL = "/api";

  function isDevMode() {
    try {
      return typeof window !== "undefined" && window.location && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    } catch (e) {
      return false;
    }
  }

  function toJsonSafe(v) {
    try {
      return JSON.stringify(v, null, 2);
    } catch (e) {
      return JSON.stringify({ error: "Failed to serialize" }, null, 2);
    }
  }

  function downloadJson(filename, obj) {
    if (typeof document === "undefined") {
      return;
    }
    var blob = new Blob([toJsonSafe(obj)], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename || "export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getClient() {
    if (typeof window === "undefined" || !window.__NETZ_API_CLIENT__) {
      throw new Error("HTTP client unavailable: services/apiClient.js was not loaded.");
    }
    return window.__NETZ_API_CLIENT__;
  }

  function parseBody(body) {
    if (typeof body === "undefined" || body === null || body === "") {
      return {};
    }
    if (typeof body === "string") {
      try {
        return JSON.parse(body);
      } catch (e) {
        return { raw: body };
      }
    }
    return body;
  }

  function fetchJson(url, opts) {
    var options = opts || {};
    var method = String(options.method || "GET").toUpperCase();
    var client = getClient();
    var path = client.toApiPathFromUrl(url);

    if (method === "GET") {
      return client.apiGet(path);
    }
    if (method === "POST") {
      return client.apiPost(path, parseBody(options.body));
    }
    if (method === "PATCH") {
      return client.apiPatch(path, parseBody(options.body));
    }
    if (method === "DELETE") {
      return client.apiDelete(path, parseBody(options.body));
    }

    throw new Error("Unsupported HTTP method in services/api.js: " + method);
  }

  function postJson(url, bodyObj) {
    return fetchJson(url, { method: "POST", body: bodyObj || {} });
  }

  function fetchDocuments(fundId) {
    var url = BASE_URL + "/funds/" + encodeURIComponent(fundId) + "/documents";
    return fetchJson(url, { method: "GET" });
  }

  function getComplianceMe(fundId) {
    var url = BASE_URL + "/funds/" + encodeURIComponent(fundId) + "/compliance/me";
    return fetchJson(url, { method: "GET" });
  }

  // --- Signatures (EPIC 9) ---

  function devMockListSignatureRequests(fundId) {
    var now = new Date().toISOString();
    return {
      __dev_mock_notice: "DEV MODE: Using mock signature requests (backend signatures endpoints not reachable).",
      items: [
        {
          id: "SIGREQ-MOCK-001",
          status: "PENDING",
          type: "BANK_PAYMENT",
          amount_usd: 1250000,
          beneficiary_name: "Example Beneficiary LLC",
          beneficiary_bank: "Example Bank",
          beneficiary_account: "****1234",
          purpose: "Capital call settlement",
          linked_entity_ref: "OBL#MOCK-0001",
          created_at_utc: now,
          deadline_utc: now,
          evidence: [
            { document_id: "DOC-MOCK-1", title: "Wire Instructions.pdf", source_blob: "" }
          ],
          signatures: []
        }
      ]
    };
  }

  function devMockGetSignatureRequest(fundId, requestId) {
    var list = devMockListSignatureRequests(fundId);
    var found = (list.items || []).filter(function (x) { return x.id === requestId; })[0] || (list.items || [])[0] || {};
    return {
      __dev_mock_notice: list.__dev_mock_notice,
      request: found,
      evidence: found.evidence || [],
      signatures: found.signatures || []
    };
  }

  function listSignatureRequests(fundId) {
    var url = BASE_URL + "/funds/" + encodeURIComponent(fundId) + "/signatures";
    return fetchJson(url, { method: "GET" }).catch(function (err) {
      if (isDevMode()) {
        return devMockListSignatureRequests(fundId);
      }
      throw err;
    });
  }

  function getSignatureRequest(fundId, requestId) {
    var url = BASE_URL + "/funds/" + encodeURIComponent(fundId) + "/signatures/" + encodeURIComponent(requestId);
    return fetchJson(url, { method: "GET" }).catch(function (err) {
      if (isDevMode()) {
        return devMockGetSignatureRequest(fundId, requestId);
      }
      throw err;
    });
  }

  function signRequest(fundId, requestId, payload) {
    var url = BASE_URL + "/funds/" + encodeURIComponent(fundId) + "/signatures/" + encodeURIComponent(requestId) + "/sign";
    return postJson(url, payload || {});
  }

  function rejectRequest(fundId, requestId, reason) {
    var url = BASE_URL + "/funds/" + encodeURIComponent(fundId) + "/signatures/" + encodeURIComponent(requestId) + "/reject";
    return postJson(url, { reason: reason });
  }

  function exportExecutionPack(fundId, requestId) {
    var url = BASE_URL + "/funds/" + encodeURIComponent(fundId) + "/signatures/" + encodeURIComponent(requestId) + "/execution-pack";
    return postJson(url, {});
  }

  return {
    getBaseUrl: function () {
      return BASE_URL;
    },
    isDevMode: isDevMode,
    downloadJson: downloadJson,
    fetchJson: fetchJson,
    postJson: postJson,
    fetchDocuments: fetchDocuments
    ,
    getComplianceMe: getComplianceMe,
    listSignatureRequests: listSignatureRequests,
    getSignatureRequest: getSignatureRequest,
    signRequest: signRequest,
    rejectRequest: rejectRequest,
    exportExecutionPack: exportExecutionPack
    ,
    ensureAuthenticated: function () {
      return getClient().ensureAuthenticated();
    }
  };
});

