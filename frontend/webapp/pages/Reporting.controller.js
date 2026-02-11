sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "netz/fund/os/api/reporting"
], function (Controller, JSONModel, MessageToast, reportingApi) {
  "use strict";

  function getFundIdFromQuery() {
    var q = new URLSearchParams(window.location.search || "");
    return q.get("fundId") || q.get("fund_id") || "";
  }

  function downloadText(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType || "text/plain" });
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

  function downloadJson(filename, obj) {
    downloadText(filename, JSON.stringify(obj || {}, null, 2), "application/json");
  }

  function csvEscape(v) {
    if (v === null || typeof v === "undefined") return "";
    var s = String(v);
    if (s.indexOf('"') >= 0) s = s.replace(/"/g, '""');
    if (/[\n\r,]/.test(s) || s.indexOf('"') >= 0) return '"' + s + '"';
    return s;
  }

  function toCsv(rows, columns) {
    var header = columns.map(function (c) { return csvEscape(c.header); }).join(",");
    var lines = [header];
    rows.forEach(function (r) {
      lines.push(columns.map(function (c) { return csvEscape(r[c.key]); }).join(","));
    });
    return lines.join("\n");
  }

  function nowStamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }

  return Controller.extend("netz.fund.os.pages.Reporting", {
    onInit: function () {
      var model = new JSONModel({
        fundId: getFundIdFromQuery(),
        busy: false,
        errorMessage: "",
        evidencePacks: [],
        complianceSnapshot: {},
        cashSnapshot: {},
        aiActivity: []
      });
      this.getView().setModel(model, "reporting");

      this._refreshAll();
    },

    _setError: function (message) {
      var m = this.getView().getModel("reporting");
      m.setProperty("/errorMessage", message || "Request failed");
    },

    _clearError: function () {
      this.getView().getModel("reporting").setProperty("/errorMessage", "");
    },

    _withBusy: function (fn) {
      var m = this.getView().getModel("reporting");
      if (m.getProperty("/busy")) return;
      m.setProperty("/busy", true);
      var that = this;
      return Promise.resolve()
        .then(fn)
        .catch(function (err) {
          if (err && err.status === 403) {
            that._setError("Forbidden");
            return;
          }
          that._setError(err && err.message ? String(err.message) : "Request failed");
        })
        .finally(function () {
          m.setProperty("/busy", false);
        });
    },

    _refreshAll: function () {
      var that = this;
      return this._withBusy(function () {
        that._clearError();
        return Promise.all([
          that._loadEvidencePacks(),
          that._loadComplianceSnapshot(),
          that._loadCashSnapshot(),
          that._loadAIActivity()
        ]);
      });
    },

    _loadEvidencePacks: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId");
      if (!fundId) {
        this._setError("Missing fundId in URL (?fundId=...)");
        return Promise.resolve();
      }

      return reportingApi.exportEvidencePack(fundId, { limit: 50 }).then(function (manifest) {
        var items = (manifest && manifest.items) ? manifest.items : [];
        var rows = items.map(function (it) {
          return {
            question_id: it.question_id,
            answer_id: it.answer_id,
            question: it.question,
            created_at_utc: it.created_at_utc,
            citations_count: (it.citations || []).length,
            citations: it.citations,
            answer: it.answer
          };
        });
        m.setProperty("/evidencePacks", rows);
      });
    },

    _loadComplianceSnapshot: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId");
      if (!fundId) return Promise.resolve();
      return reportingApi.getComplianceSnapshot(fundId).then(function (snap) {
        m.setProperty("/complianceSnapshot", snap || {});
      });
    },

    _loadCashSnapshot: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId");
      if (!fundId) return Promise.resolve();
      return reportingApi.getCashSnapshot(fundId).then(function (snap) {
        m.setProperty("/cashSnapshot", snap || {});
      });
    },

    _loadAIActivity: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId");
      if (!fundId) return Promise.resolve();
      return reportingApi.getAIActivity(fundId, { limit: 100, offset: 0 }).then(function (page) {
        m.setProperty("/aiActivity", (page && page.items) ? page.items : []);
      });
    },

    onRefreshEvidencePacks: function () {
      var that = this;
      return this._withBusy(function () { return that._loadEvidencePacks(); });
    },

    onRefreshCompliance: function () {
      var that = this;
      return this._withBusy(function () { return that._loadComplianceSnapshot(); });
    },

    onRefreshCash: function () {
      var that = this;
      return this._withBusy(function () { return that._loadCashSnapshot(); });
    },

    onRefreshAIActivity: function () {
      var that = this;
      return this._withBusy(function () { return that._loadAIActivity(); });
    },

    onExportEvidencePackItem: function (event) {
      var ctx = event.getSource().getBindingContext("reporting");
      if (!ctx) return;
      var row = ctx.getObject();
      var fundId = this.getView().getModel("reporting").getProperty("/fundId") || "fund";
      downloadJson("evidence-pack-item_" + fundId + "_" + (row.answer_id || "") + "_" + nowStamp() + ".json", row);
      MessageToast.show("Exported JSON");
    },

    onExportEvidencePacksJson: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId") || "fund";
      downloadJson("evidence-packs_" + fundId + "_" + nowStamp() + ".json", m.getProperty("/evidencePacks") || []);
    },

    onExportEvidencePacksCsv: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId") || "fund";
      var rows = m.getProperty("/evidencePacks") || [];
      var csv = toCsv(rows, [
        { header: "question", key: "question" },
        { header: "created_at_utc", key: "created_at_utc" },
        { header: "citations_count", key: "citations_count" }
      ]);
      downloadText("evidence-packs_" + fundId + "_" + nowStamp() + ".csv", csv, "text/csv");
    },

    onExportComplianceJson: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId") || "fund";
      downloadJson("compliance-snapshot_" + fundId + "_" + nowStamp() + ".json", m.getProperty("/complianceSnapshot") || {});
    },

    onExportCashJson: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId") || "fund";
      downloadJson("cash-snapshot_" + fundId + "_" + nowStamp() + ".json", m.getProperty("/cashSnapshot") || {});
    },

    onExportAIActivityJson: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId") || "fund";
      downloadJson("ai-activity_" + fundId + "_" + nowStamp() + ".json", m.getProperty("/aiActivity") || []);
    },

    onExportAIActivityCsv: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId") || "fund";
      var rows = m.getProperty("/aiActivity") || [];
      var csv = toCsv(rows, [
        { header: "question", key: "question" },
        { header: "asked_by", key: "asked_by" },
        { header: "timestamp_utc", key: "timestamp_utc" },
        { header: "insufficient_evidence", key: "insufficient_evidence" },
        { header: "citations_count", key: "citations_count" }
      ]);
      downloadText("ai-activity_" + fundId + "_" + nowStamp() + ".csv", csv, "text/csv");
    },

    onExportAllJson: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId") || "fund";
      var out = {
        exported_at_utc: new Date().toISOString(),
        fund_id: fundId,
        evidence_packs: m.getProperty("/evidencePacks") || [],
        compliance_snapshot: m.getProperty("/complianceSnapshot") || {},
        cash_snapshot: m.getProperty("/cashSnapshot") || {},
        ai_activity: m.getProperty("/aiActivity") || []
      };
      downloadJson("binder_" + fundId + "_" + nowStamp() + ".json", out);
    },

    onExportAllCsv: function () {
      var m = this.getView().getModel("reporting");
      var fundId = m.getProperty("/fundId") || "fund";

      var comp = m.getProperty("/complianceSnapshot") || {};
      var cash = m.getProperty("/cashSnapshot") || {};

      var rows = [
        { section: "compliance", key: "total_open_obligations", value: comp.total_open_obligations },
        { section: "compliance", key: "total_ai_gaps", value: comp.total_ai_gaps },
        { section: "compliance", key: "closed_obligations_last_30_days", value: comp.closed_obligations_last_30_days },
        { section: "compliance", key: "generated_at_utc", value: comp.generated_at_utc },
        { section: "cash", key: "total_inflows_usd", value: cash.total_inflows_usd },
        { section: "cash", key: "total_outflows_usd", value: cash.total_outflows_usd },
        { section: "cash", key: "pending_payment_orders", value: cash.pending_payment_orders },
        { section: "cash", key: "last_reconciliation_date", value: cash.last_reconciliation_date },
        { section: "cash", key: "generated_at_utc", value: cash.generated_at_utc }
      ];

      var csv = toCsv(rows, [
        { header: "section", key: "section" },
        { header: "key", key: "key" },
        { header: "value", key: "value" }
      ]);

      downloadText("binder-snapshots_" + fundId + "_" + nowStamp() + ".csv", csv, "text/csv");
    }
  });
});
