sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Fragment",
  "netz/fund/os/api/compliance"
], function (Controller, JSONModel, Fragment, complianceApi) {
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

  return Controller.extend("netz.fund.os.pages.Compliance", {
    onInit: function () {
      var model = new JSONModel({
        status: "idle",
        errorMessage: "",
        selectedTab: "obligations",
        fundId: getFundIdFromQuery(),
        roles: [],
        canWrite: false,
        create: {
          name: "",
          regulator: "",
          description: "",
          is_active: true,
          errorMessage: ""
        },
        obligations: [],
        gaps: [],
        closed: []
      });
      this.getView().setModel(model, "compliance");

      this._loadAll();
    },

    _resetCreateModel: function () {
      var m = this.getView().getModel("compliance");
      m.setProperty("/create/name", "");
      m.setProperty("/create/regulator", "");
      m.setProperty("/create/description", "");
      m.setProperty("/create/is_active", true);
      m.setProperty("/create/errorMessage", "");
    },

    _openCreateDialog: function () {
      var that = this;
      if (this._createDialog) {
        this._resetCreateModel();
        this._createDialog.open();
        return Promise.resolve();
      }

      return Fragment.load({
        id: this.getView().getId(),
        name: "netz.fund.os.pages.fragments.CreateObligation.dialog",
        controller: this
      }).then(function (dlg) {
        that._createDialog = dlg;
        that.getView().addDependent(dlg);
        that._resetCreateModel();
        dlg.open();
      });
    },

    _setError: function (err) {
      var m = this.getView().getModel("compliance");
      m.setProperty("/status", "error");
      m.setProperty("/errorMessage", err && err.message ? String(err.message) : "Unknown error");
    },

    _loadMe: function () {
      var m = this.getView().getModel("compliance");
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

    _loadObligations: function () {
      var m = this.getView().getModel("compliance");
      var fundId = m.getProperty("/fundId");
      return complianceApi.listObligations(fundId, { view: "active" }).then(function (page) {
        m.setProperty("/obligations", (page && page.items) ? page.items : []);
      });
    },

    _loadClosed: function () {
      var m = this.getView().getModel("compliance");
      var fundId = m.getProperty("/fundId");
      return complianceApi.listObligations(fundId, { view: "closed" }).then(function (page) {
        m.setProperty("/closed", (page && page.items) ? page.items : []);
      });
    },

    _loadGaps: function () {
      var m = this.getView().getModel("compliance");
      var fundId = m.getProperty("/fundId");
      return complianceApi.listGaps(fundId).then(function (page) {
        m.setProperty("/gaps", (page && page.items) ? page.items : []);
      });
    },

    _loadAll: function () {
      var m = this.getView().getModel("compliance");
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
          return Promise.all([that._loadObligations(), that._loadGaps(), that._loadClosed()]);
        })
        .then(function () {
          m.setProperty("/status", "ready");
        })
        .catch(function (err) {
          that._setError(err);
        });
    },

    onTabSelect: function (evt) {
      var key = evt.getParameter("key");
      this.getView().getModel("compliance").setProperty("/selectedTab", key);
    },

    onRefreshObligations: function () {
      var that = this;
      this._loadObligations().catch(function (err) { that._setError(err); });
    },

    onRefreshClosed: function () {
      var that = this;
      this._loadClosed().catch(function (err) { that._setError(err); });
    },

    onRefreshGaps: function () {
      var that = this;
      this._loadGaps().catch(function (err) { that._setError(err); });
    },

    onRecomputeGaps: function () {
      var m = this.getView().getModel("compliance");
      var fundId = m.getProperty("/fundId");
      var that = this;
      complianceApi.recomputeGaps(fundId)
        .then(function () { return that._loadGaps(); })
        .catch(function (err) { that._setError(err); });
    },

    onCreateObligation: function () {
      var m = this.getView().getModel("compliance");
      if (!m.getProperty("/canWrite")) {
        return;
      }
      var that = this;
      this._openCreateDialog().catch(function (err) {
        that._setError(err);
      });
    },

    onCreateObligationCancel: function () {
      if (this._createDialog) {
        this._createDialog.close();
      }
    },

    onCreateObligationAfterClose: function () {
      this._resetCreateModel();
    },

    onCreateObligationConfirm: function () {
      var m = this.getView().getModel("compliance");
      var fundId = m.getProperty("/fundId");
      var name = (m.getProperty("/create/name") || "").trim();
      var regulator = (m.getProperty("/create/regulator") || "").trim();
      var description = m.getProperty("/create/description");
      var isActive = !!m.getProperty("/create/is_active");

      m.setProperty("/create/errorMessage", "");

      if (!name) {
        m.setProperty("/create/errorMessage", "Name is required");
        return;
      }

      var payload = {
        name: name,
        regulator: regulator || null,
        description: (description && String(description).trim()) ? String(description).trim() : null,
        is_active: isActive
      };

      var that = this;
      complianceApi.createObligation(fundId, payload)
        .then(function () {
          if (that._createDialog) {
            that._createDialog.close();
          }
          return that._loadObligations();
        })
        .catch(function (err) {
          m.setProperty("/create/errorMessage", err && err.message ? String(err.message) : "Failed to create obligation");
        });
    },

    onOpenObligation: function (evt) {
      var ctx = evt.getSource().getBindingContext("compliance");
      if (!ctx) {
        return;
      }
      var obligationId = ctx.getProperty("id");
      var m = this.getView().getModel("compliance");
      var fundId = m.getProperty("/fundId");
      this.getOwnerComponent().getRouter().navTo("obligationDetail", { obligationId: obligationId }, false);

      // Ensure fundId stays in URL (app relies on query param)
      if (fundId) {
        var u = new URL(window.location.href);
        u.searchParams.set("fundId", fundId);
        window.history.replaceState({}, "", u.toString());
      }
    },

    onOpenGapAsObligation: function (evt) {
      // Gaps are obligations with AI prefix; navigate to same detail view.
      this.onOpenObligation(evt);
    }
  });
});
