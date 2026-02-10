sap.ui.define([], function () {
  "use strict";

  var BASE_URL = "https://netz-prod-api.azurewebsites.net";

  function assertOk(res, url) {
    if (res.ok) {
      return;
    }
    var err = new Error("HTTP " + res.status + " " + res.statusText + " for " + url);
    err.status = res.status;
    throw err;
  }

  function fetchDocuments(fundId) {
    var url = BASE_URL + "/funds/" + encodeURIComponent(fundId) + "/documents";
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

  return {
    getBaseUrl: function () {
      return BASE_URL;
    },
    fetchDocuments: fetchDocuments
  };
});

