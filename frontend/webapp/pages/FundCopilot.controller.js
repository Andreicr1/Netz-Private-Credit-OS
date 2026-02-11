sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "netz/fund/os/api/copilot"
], function (Controller, JSONModel, copilotApi) {
  "use strict";

  function getFundIdFromQuery() {
    var q = new URLSearchParams(window.location.search || "");
    return q.get("fundId") || q.get("fund_id") || "";
  }

  function downloadJson(filename, obj) {
    var json = JSON.stringify(obj || {}, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);

    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (e) { /* no-op */ }
    }, 1000);
  }

  return Controller.extend("netz.fund.os.pages.FundCopilot", {
    onInit: function () {
      var model = new JSONModel({
        fundId: getFundIdFromQuery(),
        questionText: "",
        status: "idle", // idle|loading|ready|insufficient_evidence|scope_forbidden|error
        errorMessage: "",
        answerText: "",
        citations: [],
        hasAnswer: false,
        hasCitations: false,
        historyVisible: true,
        historyMessage: "",
        history: []
      });
      this.getView().setModel(model, "copilot");

      this._tryLoadHistory();
    },

    _setError: function (message) {
      var m = this.getView().getModel("copilot");
      m.setProperty("/status", "error");
      m.setProperty("/errorMessage", message || "Request failed");
    },

    _resetResults: function () {
      var m = this.getView().getModel("copilot");
      m.setProperty("/errorMessage", "");
      m.setProperty("/answerText", "");
      m.setProperty("/citations", []);
      m.setProperty("/hasAnswer", false);
      m.setProperty("/hasCitations", false);
    },

    _tryLoadHistory: function () {
      var m = this.getView().getModel("copilot");
      var fundId = m.getProperty("/fundId");
      var that = this;

      if (!fundId) {
        m.setProperty("/historyMessage", "Missing fundId in URL (?fundId=...).");
        return;
      }

      copilotApi.listHistoryQuestions(fundId, { limit: 20 })
        .then(function (page) {
          // Contract is unknown/not implemented in this backend.
          var items = (page && page.items) ? page.items : [];
          m.setProperty("/history", items);
          m.setProperty("/historyMessage", items.length ? "" : "No history items returned.");
        })
        .catch(function (err) {
          if (err && err.status === 404) {
            m.setProperty("/historyMessage", "Conversation history endpoint is not available in this backend.");
            m.setProperty("/history", []);
            return;
          }
          m.setProperty("/historyMessage", err && err.message ? String(err.message) : "Failed to load history");
        });
    },

    onSubmit: function () {
      var m = this.getView().getModel("copilot");
      var fundId = m.getProperty("/fundId");
      var question = (m.getProperty("/questionText") || "").trim();

      this._resetResults();

      if (!fundId) {
        this._setError("Missing fundId in URL (?fundId=...)");
        return;
      }
      if (!question) {
        return;
      }

      m.setProperty("/status", "loading");

      var retrievePayload = { query: question, root_folder: null, top_k: 6 };
      var answerPayload = { question: question, root_folder: null, top_k: 6 };

      var evidenceMap = {};
      var that = this;

      copilotApi.retrieve(fundId, retrievePayload)
        .then(function (retr) {
          var results = (retr && retr.results) ? retr.results : [];
          results.forEach(function (r) {
            evidenceMap[String(r.chunk_id)] = {
              document_title: r.document_title,
              root_folder: r.root_folder,
              folder_path: r.folder_path,
              version_id: r.version_id,
              version_number: r.version_number,
              source_blob: r.source_blob
            };
          });
          return copilotApi.answer(fundId, answerPayload);
        })
        .then(function (resp) {
          var answerText = (resp && typeof resp.answer === "string") ? resp.answer : "";
          var citations = (resp && resp.citations) ? resp.citations : [];

          m.setProperty("/answerText", answerText);
          m.setProperty("/hasAnswer", true);

          if (answerText === "Insufficient evidence in the Data Room") {
            m.setProperty("/status", "insufficient_evidence");
            m.setProperty("/citations", []);
            m.setProperty("/hasCitations", false);
            return;
          }

          var out = citations.map(function (c) {
            var meta = evidenceMap[String(c.chunk_id)] || {};
            return {
              chunk_id: c.chunk_id,
              document_id: c.document_id,
              version_id: c.version_id,
              page_start: c.page_start,
              page_end: c.page_end,
              root_folder: meta.root_folder || "",
              folder_path: meta.folder_path || "",
              document_title: meta.document_title || "",
              version_number: meta.version_number || "",
              source_blob: c.source_blob || meta.source_blob || ""
            };
          });

          m.setProperty("/citations", out);
          m.setProperty("/hasCitations", out.length > 0);
          m.setProperty("/status", "ready");
        })
        .catch(function (err) {
          if (err && err.status === 403) {
            m.setProperty("/status", "scope_forbidden");
            return;
          }
          that._setError(err && err.message ? String(err.message) : "Request failed");
        });
    },

    onExportEvidencePack: function () {
      var m = this.getView().getModel("copilot");
      var fundId = m.getProperty("/fundId");
      if (!fundId) {
        this._setError("Missing fundId in URL (?fundId=...)");
        return;
      }

      var that = this;
      m.setProperty("/status", "loading");
      copilotApi.exportEvidencePack(fundId, { limit: 20 })
        .then(function (manifest) {
          var ts = new Date().toISOString().replace(/[:.]/g, "-");
          downloadJson("evidence-pack_" + fundId + "_" + ts + ".json", manifest);
          m.setProperty("/status", "ready");
        })
        .catch(function (err) {
          that._setError(err && err.message ? String(err.message) : "Export failed");
        });
    }
  });
});
