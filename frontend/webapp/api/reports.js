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

  function getArchiveUrl(fundId, periodMonth) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/archive";
    if (periodMonth) {
      url += "?period_month=" + encodeURIComponent(periodMonth);
    }
    return url;
  }

  function getArchive(fundId, periodMonth) {
    return getJson(getArchiveUrl(fundId, periodMonth));
  }

  function listNavSnapshots(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/nav/snapshots";
    return getJson(url);
  }

  function getNavSnapshot(fundId, snapshotId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/nav/snapshots/" + encodeURIComponent(snapshotId);
    return getJson(url);
  }

  function createNavSnapshot(fundId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/nav/snapshots";
    return postJson(url, payload || {});
  }

  function finalizeNavSnapshot(fundId, snapshotId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/nav/snapshots/" + encodeURIComponent(snapshotId) + "/finalize";
    return postJson(url, {});
  }

  function publishNavSnapshot(fundId, snapshotId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/nav/snapshots/" + encodeURIComponent(snapshotId) + "/publish";
    return postJson(url, {});
  }

  function recordAssetValuation(fundId, snapshotId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/nav/snapshots/" + encodeURIComponent(snapshotId) + "/assets";
    return postJson(url, payload || {});
  }

  function listMonthlyPacks(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/monthly-pack/list";
    return getJson(url);
  }

  function generateMonthlyPack(fundId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/monthly-pack/generate";
    return postJson(url, payload || {});
  }

  function getMonthlyPackDownloadUrl(fundId, packId) {
    var baseUrl = api.getBaseUrl();
    return baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/monthly-pack/" + encodeURIComponent(packId) + "/download";
  }

  function listInvestorStatements(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/investor-statements";
    return getJson(url);
  }

  function generateInvestorStatement(fundId, payload) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/investor-statements/generate";
    return postJson(url, payload || {});
  }

  function getInvestorStatementDownloadUrl(fundId, statementId) {
    var baseUrl = api.getBaseUrl();
    return baseUrl + "/funds/" + encodeURIComponent(fundId) + "/reports/investor-statements/" + encodeURIComponent(statementId) + "/download";
  }

  return {
    getArchive: getArchive,
    getArchiveUrl: getArchiveUrl,
    listNavSnapshots: listNavSnapshots,
    getNavSnapshot: getNavSnapshot,
    createNavSnapshot: createNavSnapshot,
    finalizeNavSnapshot: finalizeNavSnapshot,
    publishNavSnapshot: publishNavSnapshot,
    recordAssetValuation: recordAssetValuation,
    listMonthlyPacks: listMonthlyPacks,
    generateMonthlyPack: generateMonthlyPack,
    getMonthlyPackDownloadUrl: getMonthlyPackDownloadUrl,
    listInvestorStatements: listInvestorStatements,
    generateInvestorStatement: generateInvestorStatement,
    getInvestorStatementDownloadUrl: getInvestorStatementDownloadUrl
  };
});
