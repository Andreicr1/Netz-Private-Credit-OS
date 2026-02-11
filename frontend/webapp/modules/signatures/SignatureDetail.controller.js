sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/UIComponent",
  "sap/m/MessageToast",
  "netz/fund/os/services/api"
], function (Controller, JSONModel, UIComponent, MessageToast, api) {
  "use strict";

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function safeStr(v) {
    return (v === null || typeof v === "undefined") ? "" : String(v);
  }

  return Controller.extend("netz.fund.os.modules.signatures.SignatureDetail", {
    onInit: function () {
      var router = UIComponent.getRouterFor(this);
      router.getRoute("signatureDetail").attachMatched(this._onRouteMatched, this);

      var m = new JSONModel({
        fundId: "",
        requestId: "",
        busy: false,
        errorMessage: "",
        devNotice: "",
        me: { actor_id: "", roles: [] },
        request: {},
        evidence: [],
        evidenceCount: 0,
        signatures: [],
        requiredSignatures: 2,
        canSign: false,
        canReject: false,
        canSignNow: false,
        canRejectNow: false,
        canExportPack: false,
        signComment: "",
        rejectReason: "",
        rejectReasonError: false
      });
      this.getView().setModel(m, "signatureDetail");
    },

    _onRouteMatched: function (event) {
      var args = event.getParameter("arguments") || {};
      var m = this.getView().getModel("signatureDetail");
      m.setProperty("/fundId", args.fundId || "");
      m.setProperty("/requestId", args.requestId || "");
      this._load();
    },

    _withBusy: function (fn) {
      var m = this.getView().getModel("signatureDetail");
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

    _setError: function (msg) {
      this.getView().getModel("signatureDetail").setProperty("/errorMessage", msg || "Request failed");
    },

    _clearError: function () {
      this.getView().getModel("signatureDetail").setProperty("/errorMessage", "");
    },

    _load: function () {
      var that = this;
      return this._withBusy(function () {
        that._clearError();
        var m = that.getView().getModel("signatureDetail");
        var fundId = m.getProperty("/fundId");
        var requestId = m.getProperty("/requestId");
        if (!fundId || !requestId) {
          that._setError("Missing fundId/requestId in route.");
          return;
        }

        return api.getComplianceMe(fundId)
          .then(function (me) {
            m.setProperty("/me", me || { actor_id: "", roles: [] });
          })
          .catch(function () {
            m.setProperty("/me", { actor_id: "", roles: [] });
          })
          .then(function () {
            return api.getSignatureRequest(fundId, requestId);
          })
          .then(function (res) {
            if (res && res.__dev_mock_notice) {
              m.setProperty("/devNotice", res.__dev_mock_notice);
            } else {
              m.setProperty("/devNotice", "");
            }

            var req = res && res.request ? res.request : res;
            m.setProperty("/request", req || {});

            var evidence = asArray(res && res.evidence ? res.evidence : req && req.evidence);
            m.setProperty("/evidence", evidence);
            m.setProperty("/evidenceCount", evidence.length);

            var sigs = asArray(res && res.signatures ? res.signatures : req && req.signatures);
            m.setProperty("/signatures", sigs);

            that._computeGuards();
          })
          .catch(function (err) {
            that._setError(err && err.message ? String(err.message) : "Failed to load signature request");
          });
      });
    },

    _computeGuards: function () {
      var m = this.getView().getModel("signatureDetail");
      var me = m.getProperty("/me") || { roles: [] };
      var roles = me.roles || [];
      var actorId = me.actor_id || "";

      var canDirector = roles.indexOf("DIRECTOR") >= 0 && roles.indexOf("AUDITOR") < 0;
      var canReject = canDirector;

      var req = m.getProperty("/request") || {};
      var status = safeStr(req.status);
      var evidenceCount = m.getProperty("/evidenceCount") || 0;

      var sigs = asArray(m.getProperty("/signatures"));
      var distinctDirectorIds = {};
      sigs.forEach(function (s) {
        var did = safeStr(s.director_id || s.director_actor_id || s.actor_id);
        if (did) distinctDirectorIds[did] = true;
      });
      var distinctCount = Object.keys(distinctDirectorIds).length;

      var alreadySignedByMe = actorId && distinctDirectorIds[actorId] === true;

      // Hard guard: no evidence -> cannot sign/submit.
      var blockedMissingEvidence = evidenceCount === 0;

      // Only allow signing when pending and < 2 distinct signatures.
      var canSignNow = canDirector && !alreadySignedByMe && !blockedMissingEvidence && status === "PENDING" && distinctCount < 2;
      var canRejectNow = canReject && status === "PENDING";

      var canExport = (status === "SIGNED" || (distinctCount >= 2 && status === "PENDING"));

      m.setProperty("/canSign", canDirector);
      m.setProperty("/canReject", canReject);
      m.setProperty("/canSignNow", canSignNow);
      m.setProperty("/canRejectNow", canRejectNow);
      m.setProperty("/canExportPack", canExport);
    },

    onRefresh: function () {
      return this._load();
    },

    onNavBack: function () {
      var m = this.getView().getModel("signatureDetail");
      UIComponent.getRouterFor(this).navTo("signatures", { fundId: m.getProperty("/fundId") }, true);
    },

    onOpenSignDialog: function () {
      this.byId("signDialog").open();
    },

    onCloseSignDialog: function () {
      var m = this.getView().getModel("signatureDetail");
      m.setProperty("/signComment", "");
      this.byId("signDialog").close();
    },

    onConfirmSign: function () {
      var that = this;
      return this._withBusy(function () {
        var m = that.getView().getModel("signatureDetail");
        var fundId = m.getProperty("/fundId");
        var requestId = m.getProperty("/requestId");
        var comment = m.getProperty("/signComment") || "";

        return api.signRequest(fundId, requestId, { comment: comment })
          .then(function () {
            MessageToast.show("Signed (audit-recorded)");
            that.onCloseSignDialog();
            return that._load();
          });
      });
    },

    onOpenRejectDialog: function () {
      var m = this.getView().getModel("signatureDetail");
      m.setProperty("/rejectReasonError", false);
      this.byId("rejectDialog").open();
    },

    onCloseRejectDialog: function () {
      var m = this.getView().getModel("signatureDetail");
      m.setProperty("/rejectReason", "");
      m.setProperty("/rejectReasonError", false);
      this.byId("rejectDialog").close();
    },

    onConfirmReject: function () {
      var m = this.getView().getModel("signatureDetail");
      var reason = String(m.getProperty("/rejectReason") || "").trim();
      if (!reason) {
        m.setProperty("/rejectReasonError", true);
        return;
      }

      var that = this;
      return this._withBusy(function () {
        var fundId = m.getProperty("/fundId");
        var requestId = m.getProperty("/requestId");
        return api.rejectRequest(fundId, requestId, reason)
          .then(function () {
            MessageToast.show("Rejected (audit-recorded)");
            that.onCloseRejectDialog();
            return that._load();
          });
      });
    },

    onExportExecutionPack: function () {
      var that = this;
      return this._withBusy(function () {
        var m = that.getView().getModel("signatureDetail");
        var fundId = m.getProperty("/fundId");
        var requestId = m.getProperty("/requestId");
        return api.exportExecutionPack(fundId, requestId).then(function (pack) {
          api.downloadJson("execution-pack_" + fundId + "_" + requestId + ".json", pack);
          MessageToast.show("Execution Pack exported");
        });
      });
    }
  });
});
