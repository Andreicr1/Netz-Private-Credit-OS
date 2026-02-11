sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/URLHelper",
  "netz/fund/os/services/api",
  "netz/fund/os/api/reports"
], function (Controller, JSONModel, MessageToast, URLHelper, api, reportsApi) {
  "use strict";

  function getFundIdFromQuery() {
    var q = new URLSearchParams(window.location.search || "");
    return q.get("fundId") || q.get("fund_id") || "";
  }

  return Controller.extend("netz.fund.os.modules.reporting.Reporting", {
    onInit: function () {
      this._selectedSnapshotId = null;

      var reportsModel = new JSONModel({
        fundId: getFundIdFromQuery(),
        busy: false,
        errorMessage: "",
        periodMonth: "",
        nav_snapshots: [],
        monthly_packs: [],
        investor_statements: []
      });
      this.getView().setModel(reportsModel, "reports");

      var dataModel = new JSONModel({
        navSnapshots: [],
        selectedSnapshot: { id: null, assets: [] }
      });
      this.getView().setModel(dataModel, "data");

      var viewModel = new JSONModel({
        roles: [],
        canWrite: false
      });
      this.getView().setModel(viewModel, "view");

      var opModel = new JSONModel({
        newSnapshot: {
          period_month: "",
          nav_total_usd: ""
        },
        newValuation: {
          nav_snapshot_id: "",
          asset_id: "",
          asset_type: "",
          valuation_usd: "",
          valuation_method: "AMORTIZED_COST",
          supporting_document_id: ""
        },
        pack: {
          nav_snapshot_id: "",
          pack_type: "MONTHLY",
          include_evidence_binder: false,
          evidence_binder_limit: 100
        },
        statement: {
          period_month: "",
          investor_id: "",
          ending_balance: ""
        }
      });
      this.getView().setModel(opModel, "op");

      this.onRefreshAll();
    },

    _setError: function (message) {
      this.getView().getModel("reports").setProperty("/errorMessage", message || "Request failed");
    },

    _clearError: function () {
      this.getView().getModel("reports").setProperty("/errorMessage", "");
    },

    _withBusy: function (fn) {
      var m = this.getView().getModel("reports");
      if (m.getProperty("/busy")) return;
      m.setProperty("/busy", true);
      var that = this;
      return Promise.resolve()
        .then(fn)
        .catch(function (err) {
          that._setError(that._formatError(err));
        })
        .finally(function () {
          m.setProperty("/busy", false);
        });
    },

    _formatError: function (err) {
      if (err && err.status === 403) {
        return "Forbidden";
      }
      if (err && err.detail) {
        return String(err.detail);
      }
      return err && err.message ? String(err.message) : "Request failed";
    },

    _refreshArchive: function () {
      var that = this;
      var m = that.getView().getModel("reports");
      var fundId = m.getProperty("/fundId");
      return reportsApi.getArchive(fundId).then(function (archive) {
        m.setProperty("/nav_snapshots", (archive && archive.nav_snapshots) ? archive.nav_snapshots : []);
        m.setProperty("/monthly_packs", (archive && archive.monthly_packs) ? archive.monthly_packs : []);
        m.setProperty("/investor_statements", (archive && archive.investor_statements) ? archive.investor_statements : []);
      });
    },

    _refreshNavSnapshots: function () {
      var that = this;
      var m = that.getView().getModel("reports");
      var fundId = m.getProperty("/fundId");
      return reportsApi.listNavSnapshots(fundId).then(function (rows) {
        that.getView().getModel("data").setProperty("/navSnapshots", rows || []);
      });
    },

    _refreshMe: function () {
      var that = this;
      var m = that.getView().getModel("reports");
      var fundId = m.getProperty("/fundId");
      return api.getComplianceMe(fundId).then(function (me) {
        var roles = (me && me.roles) ? me.roles : [];
        var canWrite = roles.indexOf("ADMIN") >= 0 || roles.indexOf("GP") >= 0 || roles.indexOf("COMPLIANCE") >= 0;
        that.getView().getModel("view").setProperty("/roles", roles);
        that.getView().getModel("view").setProperty("/canWrite", !!canWrite);
      });
    },

    _ensureFundId: function () {
      var m = this.getView().getModel("reports");
      var fundId = m.getProperty("/fundId");
      if (!fundId) {
        this._setError("Missing fundId in URL (?fundId=...)");
        return null;
      }
      return fundId;
    },

    onRefreshAll: function () {
      var that = this;
      return this._withBusy(function () {
        that._clearError();
        if (!that._ensureFundId()) return;
        return Promise.all([
          that._refreshMe(),
          that._refreshArchive(),
          that._refreshNavSnapshots()
        ]);
      });
    },

    onRefresh: function () {
      return this.onRefreshAll();
    },

    onSelectSnapshot: function (event) {
      var listItem = event.getParameter("listItem");
      if (!listItem) return;
      var ctx = listItem.getBindingContext("data");
      if (!ctx) return;
      var snapshot = ctx.getObject();
      if (!snapshot || !snapshot.id) return;

      this._selectedSnapshotId = snapshot.id;
      this.getView().getModel("op").setProperty("/newValuation/nav_snapshot_id", snapshot.id);
      this.getView().getModel("op").setProperty("/pack/nav_snapshot_id", snapshot.id);

      this._loadSelectedSnapshot(snapshot.id);
    },

    _loadSelectedSnapshot: function (snapshotId) {
      var that = this;
      var m = that.getView().getModel("reports");
      var fundId = m.getProperty("/fundId");
      return reportsApi.getNavSnapshot(fundId, snapshotId)
        .then(function (payload) {
          var normalized = payload || { id: snapshotId, assets: [] };
          if (!normalized.assets) normalized.assets = [];
          that.getView().getModel("data").setProperty("/selectedSnapshot", normalized);
        })
        .catch(function (err) {
          that._setError(that._formatError(err));
        });
    },

    onCreateSnapshot: function () {
      var that = this;
      return this._withBusy(function () {
        that._clearError();
        var fundId = that._ensureFundId();
        if (!fundId) return;

        var payload = that.getView().getModel("op").getProperty("/newSnapshot") || {};
        return reportsApi.createNavSnapshot(fundId, {
          period_month: payload.period_month,
          nav_total_usd: payload.nav_total_usd === "" ? null : Number(payload.nav_total_usd)
        }).then(function () {
          that.getView().getModel("op").setProperty("/newSnapshot", { period_month: "", nav_total_usd: "" });
          MessageToast.show("Snapshot created");
          return that.onRefreshAll();
        });
      });
    },

    onFinalizeSnapshot: function (event) {
      var that = this;
      var snapshotId = that._getRowIdFromEvent(event, "data");
      if (!snapshotId) return;
      return this._withBusy(function () {
        that._clearError();
        var fundId = that._ensureFundId();
        if (!fundId) return;
        return reportsApi.finalizeNavSnapshot(fundId, snapshotId).then(function () {
          MessageToast.show("Snapshot finalized");
          return that.onRefreshAll();
        });
      });
    },

    onPublishSnapshot: function (event) {
      var that = this;
      var snapshotId = that._getRowIdFromEvent(event, "data");
      if (!snapshotId) return;
      return this._withBusy(function () {
        that._clearError();
        var fundId = that._ensureFundId();
        if (!fundId) return;
        return reportsApi.publishNavSnapshot(fundId, snapshotId).then(function () {
          MessageToast.show("Snapshot published");
          return that.onRefreshAll();
        });
      });
    },

    onRecordValuation: function () {
      var that = this;
      return this._withBusy(function () {
        that._clearError();
        var fundId = that._ensureFundId();
        if (!fundId) return;

        var payload = that.getView().getModel("op").getProperty("/newValuation") || {};
        if (!payload.nav_snapshot_id) {
          that._setError("Select a snapshot first");
          return;
        }

        return reportsApi.recordAssetValuation(fundId, payload.nav_snapshot_id, {
          asset_id: payload.asset_id,
          asset_type: payload.asset_type,
          valuation_usd: payload.valuation_usd === "" ? null : Number(payload.valuation_usd),
          valuation_method: payload.valuation_method,
          supporting_document_id: payload.supporting_document_id || null
        }).then(function () {
          MessageToast.show("Valuation recorded");
          that.getView().getModel("op").setProperty("/newValuation/asset_id", "");
          that.getView().getModel("op").setProperty("/newValuation/asset_type", "");
          that.getView().getModel("op").setProperty("/newValuation/valuation_usd", "");
          that.getView().getModel("op").setProperty("/newValuation/valuation_method", "AMORTIZED_COST");
          that.getView().getModel("op").setProperty("/newValuation/supporting_document_id", "");
          return that._loadSelectedSnapshot(payload.nav_snapshot_id);
        }).then(function () {
          return that._refreshArchive();
        });
      });
    },

    onGeneratePack: function () {
      var that = this;
      return this._withBusy(function () {
        that._clearError();
        var fundId = that._ensureFundId();
        if (!fundId) return;

        var payload = that.getView().getModel("op").getProperty("/pack") || {};
        return reportsApi.generateMonthlyPack(fundId, {
          nav_snapshot_id: payload.nav_snapshot_id,
          pack_type: payload.pack_type,
          include_evidence_binder: !!payload.include_evidence_binder,
          evidence_binder_limit: payload.evidence_binder_limit === "" ? null : Number(payload.evidence_binder_limit)
        }).then(function () {
          MessageToast.show("Pack generation started");
          return that._refreshArchive();
        });
      });
    },

    onGenerateStatement: function () {
      var that = this;
      return this._withBusy(function () {
        that._clearError();
        var fundId = that._ensureFundId();
        if (!fundId) return;

        var payload = that.getView().getModel("op").getProperty("/statement") || {};
        return reportsApi.generateInvestorStatement(fundId, {
          period_month: payload.period_month,
          investor_id: payload.investor_id,
          ending_balance: payload.ending_balance === "" ? null : Number(payload.ending_balance)
        }).then(function () {
          that.getView().getModel("op").setProperty("/statement", { period_month: "", investor_id: "", ending_balance: "" });
          MessageToast.show("Statement generated");
          return that._refreshArchive();
        });
      });
    },

    _getRowIdFromEvent: function (event, modelName) {
      try {
        var src = event.getSource();
        var parent = src;
        while (parent && typeof parent.getBindingContext !== "function") {
          parent = parent.getParent();
        }
        var ctx = parent ? parent.getBindingContext(modelName) : null;
        var obj = ctx ? ctx.getObject() : null;
        return obj && obj.id ? obj.id : null;
      } catch (e) {
        return null;
      }
    },

    onDownloadMonthlyPack: function (event) {
      var ctx = event.getSource().getBindingContext("reports");
      if (!ctx) return;
      var obj = ctx.getObject();
      var m = this.getView().getModel("reports");
      var fundId = m.getProperty("/fundId");
      if (!fundId || !obj || !obj.id) return;

      var url = reportsApi.getMonthlyPackDownloadUrl(fundId, obj.id);
      URLHelper.redirect(url, true);
      MessageToast.show("Download started");
    },

    onDownloadInvestorStatement: function (event) {
      var ctx = event.getSource().getBindingContext("reports");
      if (!ctx) return;
      var obj = ctx.getObject();
      var m = this.getView().getModel("reports");
      var fundId = m.getProperty("/fundId");
      if (!fundId || !obj || !obj.id) return;

      var url = reportsApi.getInvestorStatementDownloadUrl(fundId, obj.id);
      URLHelper.redirect(url, true);
      MessageToast.show("Download started");
    }
  });
});
