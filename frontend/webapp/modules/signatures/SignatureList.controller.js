sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/UIComponent",
  "sap/m/MessageToast",
  "netz/fund/os/services/api"
], function (Controller, JSONModel, UIComponent, MessageToast, api) {
  "use strict";

  function isDevMode() {
    var h = (window.location && window.location.hostname) ? window.location.hostname : "";
    var base = api.getBaseUrl ? String(api.getBaseUrl() || "") : "";
    return h === "localhost" || h === "127.0.0.1" || base.indexOf("localhost") >= 0 || base.indexOf("127.0.0.1") >= 0;
  }

  return Controller.extend("netz.fund.os.modules.signatures.SignatureList", {
    onInit: function () {
      var router = UIComponent.getRouterFor(this);
      router.getRoute("signatures").attachMatched(this._onRouteMatched, this);

      var m = new JSONModel({
        fundId: "",
        busy: false,
        errorMessage: "",
        devNotice: "",
        me: { actor_id: "", roles: [] },
        canSign: false,
        filters: { status: "", type: "", createdDays: "", amountThreshold: "" },
        items: [],
        filteredItems: []
      });
      this.getView().setModel(m, "signatures");
    },

    _onRouteMatched: function (event) {
      var args = event.getParameter("arguments") || {};
      var fundId = args.fundId || "";
      var m = this.getView().getModel("signatures");
      m.setProperty("/fundId", fundId);
      this._loadMeAndData();
    },

    _setError: function (msg) {
      this.getView().getModel("signatures").setProperty("/errorMessage", msg || "Request failed");
    },

    _clearError: function () {
      this.getView().getModel("signatures").setProperty("/errorMessage", "");
    },

    _withBusy: function (fn) {
      var m = this.getView().getModel("signatures");
      if (m.getProperty("/busy")) return;
      m.setProperty("/busy", true);
      var that = this;
      return Promise.resolve()
        .then(fn)
        .catch(function (err) {
          that._setError(err && err.message ? String(err.message) : "Request failed");
        })
        .finally(function () {
          m.setProperty("/busy", false);
        });
    },

    _loadMeAndData: function () {
      var that = this;
      return this._withBusy(function () {
        that._clearError();
        var m = that.getView().getModel("signatures");
        var fundId = m.getProperty("/fundId");
        if (!fundId) {
          that._setError("Missing fundId in route.");
          return;
        }

        return api.getComplianceMe(fundId)
          .then(function (me) {
            m.setProperty("/me", me || { actor_id: "", roles: [] });
            var roles = (me && me.roles) ? me.roles : [];
            var canSign = roles.indexOf("DIRECTOR") >= 0 && roles.indexOf("AUDITOR") < 0;
            m.setProperty("/canSign", canSign);
          })
          .catch(function () {
            // If /compliance/me is unavailable, proceed without role gating.
            m.setProperty("/canSign", false);
          })
          .then(function () {
            return api.listSignatureRequests(fundId);
          })
          .then(function (res) {
            if (res && res.__dev_mock_notice) {
              m.setProperty("/devNotice", res.__dev_mock_notice);
            } else {
              m.setProperty("/devNotice", "");
            }
            var items = (res && res.items) ? res.items : (Array.isArray(res) ? res : []);
            m.setProperty("/items", items);
            that._applyFilters();
          })
          .catch(function (err) {
            that._setError(err && err.message ? String(err.message) : "Failed to load signature requests");
          });
      });
    },

    _applyFilters: function () {
      var m = this.getView().getModel("signatures");
      var filters = m.getProperty("/filters") || {};
      var items = m.getProperty("/items") || [];

      var status = String(filters.status || "").trim();
      var type = String(filters.type || "").trim();
      var createdDays = String(filters.createdDays || "").trim();
      var amountThreshold = String(filters.amountThreshold || "").trim();
      var threshold = amountThreshold ? parseFloat(amountThreshold) : NaN;

      var now = Date.now();
      var daysMs = createdDays ? (parseInt(createdDays, 10) * 24 * 60 * 60 * 1000) : 0;

      var out = items.filter(function (it) {
        if (status && String(it.status || "") !== status) return false;
        if (type && String(it.type || "") !== type) return false;
        if (createdDays) {
          var t = it.created_at_utc ? Date.parse(it.created_at_utc) : NaN;
          if (!isFinite(t)) return false;
          if ((now - t) > daysMs) return false;
        }
        if (amountThreshold && isFinite(threshold)) {
          var a = parseFloat(String(it.amount_usd || it.amount || "0"));
          if (!(a > threshold)) return false;
        }
        return true;
      });

      m.setProperty("/filteredItems", out);
    },

    onFilterChange: function () {
      this._applyFilters();
    },

    onRefresh: function () {
      return this._loadMeAndData();
    },

    onView: function (event) {
      var ctx = event.getSource().getBindingContext("signatures");
      if (!ctx) return;
      var obj = ctx.getObject();
      var m = this.getView().getModel("signatures");
      UIComponent.getRouterFor(this).navTo("signatureDetail", {
        fundId: m.getProperty("/fundId"),
        requestId: obj.id
      });
    },

    onSignFromList: function (event) {
      // Signing occurs in detail view to preserve audit UX.
      this.onView(event);
      MessageToast.show("Open request to sign (audit-recorded).");
    },

    onExportFromList: function (event) {
      var ctx = event.getSource().getBindingContext("signatures");
      if (!ctx) return;
      var obj = ctx.getObject();
      var m = this.getView().getModel("signatures");
      var fundId = m.getProperty("/fundId");

      if (String(obj.status || "") !== "SIGNED") {
        MessageToast.show("Execution Pack available when status is SIGNED.");
        return;
      }

      var that = this;
      return this._withBusy(function () {
        return api.exportExecutionPack(fundId, obj.id).then(function (pack) {
          api.downloadJson("execution-pack_" + fundId + "_" + obj.id + ".json", pack);
          MessageToast.show("Execution Pack exported");
        }).catch(function (err) {
          that._setError(err && err.message ? String(err.message) : "Export failed");
        });
      });
    }
  });
});
