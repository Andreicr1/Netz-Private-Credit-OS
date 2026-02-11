sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/routing/History",
  "netz/fund/os/api/compliance",
  "netz/fund/os/api/documents"
], function (Controller, JSONModel, History, complianceApi, documentsApi) {
  "use strict";

  function getFundIdFromQuery() {
    var q = new URLSearchParams(window.location.search || "");
    return q.get("fundId") || q.get("fund_id") || "";
  }

  function hasWriteRole(roles) {
    if (!roles || !roles.length) {
      return false;
    }
    return roles.indexOf("ADMIN") >= 0 || roles.indexOf("COMPLIANCE") >= 0;
  }

  function jsonStringifySafe(value) {
    try {
      return JSON.stringify(value || {}, null, 0);
    } catch (e) {
      return "" + value;
    }
  }

  return Controller.extend("netz.fund.os.pages.ObligationDetail", {
    onInit: function () {
      var model = new JSONModel({
        status: "idle",
        errorMessage: "",
        fundId: getFundIdFromQuery(),
        obligationId: "",
        roles: [],
        canWrite: false,
        item: {},
        evidence: [],
        audit: [],
        documents: [],
        selectedDocumentId: ""
      });
      this.getView().setModel(model, "obligation");

      this.getOwnerComponent().getRouter().getRoute("obligationDetail").attachPatternMatched(this._onRouteMatched, this);
    },

    _setError: function (err) {
      var m = this.getView().getModel("obligation");
      m.setProperty("/status", "error");
      m.setProperty("/errorMessage", err && err.message ? String(err.message) : "Unknown error");
    },

    _onRouteMatched: function (evt) {
      var args = evt.getParameter("arguments") || {};
      var obligationId = args.obligationId || "";

      var m = this.getView().getModel("obligation");
      m.setProperty("/obligationId", obligationId);

      this._loadAll();
    },

    _loadMe: function () {
      var m = this.getView().getModel("obligation");
      var fundId = m.getProperty("/fundId");
      if (!fundId) {
        return Promise.resolve();
      }
      return complianceApi.me(fundId).then(function (me) {
        var roles = (me && me.roles) ? me.roles : [];
        m.setProperty("/roles", roles);
        m.setProperty("/canWrite", hasWriteRole(roles));
      });
    },

    _loadObligation: function () {
      var m = this.getView().getModel("obligation");
      var fundId = m.getProperty("/fundId");
      var obligationId = m.getProperty("/obligationId");
      return complianceApi.getObligation(fundId, obligationId).then(function (item) {
        m.setProperty("/item", item || {});
      });
    },

    _loadEvidence: function () {
      var m = this.getView().getModel("obligation");
      var fundId = m.getProperty("/fundId");
      var obligationId = m.getProperty("/obligationId");
      return complianceApi.listEvidence(fundId, obligationId).then(function (items) {
        m.setProperty("/evidence", items || []);
      });
    },

    _loadAudit: function () {
      var m = this.getView().getModel("obligation");
      var fundId = m.getProperty("/fundId");
      var obligationId = m.getProperty("/obligationId");
      return complianceApi.listAudit(fundId, obligationId).then(function (items) {
        var out = (items || []).map(function (ev) {
          return {
            created_at: ev.created_at,
            actor_id: ev.actor_id,
            action: ev.action,
            after: jsonStringifySafe(ev.after)
          };
        });
        m.setProperty("/audit", out);
      });
    },

    _loadDocuments: function () {
      var m = this.getView().getModel("obligation");
      var fundId = m.getProperty("/fundId");
      return documentsApi.listDocuments(fundId).then(function (page) {
        var items = (page && page.items) ? page.items : (page || []);
        // Evidence linking is restricted to Data Room documents on backend; keep list full for transparency.
        m.setProperty("/documents", items);
      });
    },

    _loadAll: function () {
      var m = this.getView().getModel("obligation");
      m.setProperty("/status", "loading");
      m.setProperty("/errorMessage", "");

      var fundId = m.getProperty("/fundId");
      if (!fundId) {
        this._setError(new Error("Missing fundId in URL (?fundId=...)") );
        return;
      }

      var that = this;
      this._loadMe()
        .then(function () {
          return Promise.all([
            that._loadObligation(),
            that._loadEvidence(),
            that._loadAudit(),
            that._loadDocuments()
          ]);
        })
        .then(function () {
          m.setProperty("/status", "ready");
        })
        .catch(function (err) {
          that._setError(err);
        });
    },

    onNavBack: function () {
      var history = History.getInstance();
      var previousHash = history.getPreviousHash();
      if (previousHash !== undefined) {
        window.history.go(-1);
        return;
      }
      this.getOwnerComponent().getRouter().navTo("compliance", {}, true);
    },

    onRefreshEvidence: function () {
      var that = this;
      this._loadEvidence().catch(function (err) { that._setError(err); });
    },

    onRefreshAudit: function () {
      var that = this;
      this._loadAudit().catch(function (err) { that._setError(err); });
    },

    onLinkEvidence: function () {
      var m = this.getView().getModel("obligation");
      var fundId = m.getProperty("/fundId");
      var obligationId = m.getProperty("/obligationId");
      var docId = m.getProperty("/selectedDocumentId");
      var that = this;

      complianceApi.linkEvidence(fundId, obligationId, { document_id: docId, version_id: null })
        .then(function () {
          return that._loadEvidence();
        })
        .catch(function (err) {
          that._setError(err);
        });
    },

    onMarkInProgress: function () {
      var m = this.getView().getModel("obligation");
      var fundId = m.getProperty("/fundId");
      var obligationId = m.getProperty("/obligationId");
      var that = this;

      complianceApi.markInProgress(fundId, obligationId)
        .then(function () {
          return Promise.all([that._loadObligation(), that._loadAudit()]);
        })
        .catch(function (err) {
          that._setError(err);
        });
    },

    onClose: function () {
      var m = this.getView().getModel("obligation");
      var fundId = m.getProperty("/fundId");
      var obligationId = m.getProperty("/obligationId");
      var that = this;

      complianceApi.closeObligation(fundId, obligationId)
        .then(function () {
          return Promise.all([that._loadObligation(), that._loadAudit()]);
        })
        .catch(function (err) {
          that._setError(err);
        });
    }
  });
});
