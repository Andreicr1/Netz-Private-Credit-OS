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

  function listDocuments(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/documents";

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

  function listRootFolders(fundId) {
    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/documents/root-folders";

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

  function uploadPdf(fundId, params) {
    if (!params || !params.file) {
      return Promise.reject(new Error("Missing required file"));
    }

    var file = params.file;
    var fileName = (file && file.name) ? String(file.name) : "";
    var isPdfByName = fileName.toLowerCase().endsWith(".pdf");
    var isPdfByType = (file && file.type) ? String(file.type).toLowerCase() === "application/pdf" : false;

    if (!isPdfByName && !isPdfByType) {
      return Promise.reject(new Error("Only PDF files are allowed"));
    }

    var rootFolder = params.root_folder || params.rootFolder;
    var subfolderPath = params.subfolder_path || params.subfolderPath || "";
    var domain = params.domain;
    var title = params.title || "";

    if (!rootFolder) {
      return Promise.reject(new Error("Missing required root_folder"));
    }
    if (!domain) {
      return Promise.reject(new Error("Missing required domain"));
    }

    var baseUrl = api.getBaseUrl();
    var url = baseUrl + "/funds/" + encodeURIComponent(fundId) + "/documents/upload";

    var form = new FormData();
    form.append("root_folder", rootFolder);
    form.append("subfolder_path", subfolderPath);
    form.append("domain", domain);
    form.append("title", title);
    form.append("file", file, fileName || "document.pdf");

    return fetch(url, {
      method: "POST",
      body: form
    }).then(function (res) {
      assertOk(res, url);
      return res.json();
    });
  }

  return {
    listDocuments: listDocuments,
    uploadPdf: uploadPdf,
    listRootFolders: listRootFolders
  };
});
