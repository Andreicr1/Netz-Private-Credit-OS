import { getApiBaseUrl } from "../services/env.js";
import { fetchJson, postJson, postForm } from "../services/http.js";

export function listDocuments(fundId, params = {}) {
  const qs = [];
  if (params.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params.offset != null) qs.push(`offset=${encodeURIComponent(String(params.offset))}`);
  if (params.root_folder) qs.push(`root_folder=${encodeURIComponent(String(params.root_folder))}`);
  if (params.domain) qs.push(`domain=${encodeURIComponent(String(params.domain))}`);
  if (params.q) qs.push(`q=${encodeURIComponent(String(params.q))}`);

  let url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/documents`;
  if (qs.length) url += `?${qs.join("&")}`;
  return fetchJson(url, { method: "GET" });
}

export function listRootFolders(fundId) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/documents/root-folders`;
  return fetchJson(url, { method: "GET" });
}

export function createRootFolder(fundId, name) {
  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/documents/root-folders`;
  return postJson(url, { name });
}

export function uploadPdf(fundId, params) {
  if (!params?.file) {
    return Promise.reject(new Error("Missing required file"));
  }

  const file = params.file;
  const fileName = file?.name ? String(file.name) : "";
  const isPdfByName = fileName.toLowerCase().endsWith(".pdf");
  const isPdfByType = file?.type ? String(file.type).toLowerCase() === "application/pdf" : false;
  if (!isPdfByName && !isPdfByType) {
    return Promise.reject(new Error("Only PDF files are allowed"));
  }

  const rootFolder = params.root_folder || params.rootFolder;
  const subfolderPath = params.subfolder_path || params.subfolderPath || "";
  const domain = params.domain;
  const title = params.title || "";

  if (!rootFolder) {
    return Promise.reject(new Error("Missing required root_folder"));
  }
  if (!domain) {
    return Promise.reject(new Error("Missing required domain"));
  }

  const url = `${getApiBaseUrl()}/funds/${encodeURIComponent(fundId)}/documents/upload`;
  const form = new FormData();
  form.append("root_folder", rootFolder);
  form.append("subfolder_path", subfolderPath);
  form.append("domain", domain);
  form.append("title", title);
  form.append("file", file, fileName || "document.pdf");
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
