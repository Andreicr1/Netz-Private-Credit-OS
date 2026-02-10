sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "netz/fund/os/services/api"
], function (Controller, JSONModel, api) {
  "use strict";

  function getFundIdFromUrl() {
    try {
      var url = new URL(window.location.href);
      return url.searchParams.get("fundId") || "00000000-0000-0000-0000-000000000000";
    } catch (e) {
      return "00000000-0000-0000-0000-000000000000";
    }
  }

  function extractItems(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && Array.isArray(payload.items)) {
      return payload.items;
    }
    if (payload && Array.isArray(payload.documents)) {
      return payload.documents;
    }
    return [];
  }

  return Controller.extend("netz.fund.os.pages.DataRoom", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ items: [], status: "idle", errorMessage: "" }), "dataroom");
      this._fundId = getFundIdFromUrl();
      this._load();
    },

    onRefresh: function () {
      this._load();
    },

    _load: async function () {
      var view = this.getView();
      var model = view.getModel("dataroom");

      try {
        view.setBusy(true);
        model.setProperty("/status", "loading");
        model.setProperty("/errorMessage", "");

        var payload = await api.fetchDocuments(this._fundId);
        model.setProperty("/items", extractItems(payload));
        model.setProperty("/status", "ready");
      } catch (e) {
        model.setProperty("/items", []);
        model.setProperty("/status", "error");
        model.setProperty("/errorMessage", (e && e.message) ? e.message : String(e));
      } finally {
        view.setBusy(false);
      }
    }
  });
});

