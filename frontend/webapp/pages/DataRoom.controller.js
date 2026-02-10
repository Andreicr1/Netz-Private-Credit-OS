sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "netz/fund/os/services/api"
], function (Controller, JSONModel, api) {
  "use strict";

  function getFundIdFromUrl() {
    try {
      var url = new URL(window.location.href);
      return url.searchParams.get("fundId") || "static-fund-id";
    } catch (e) {
      return "static-fund-id";
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
      this.getView().setModel(new JSONModel({ items: [], status: "idle" }), "dataroom");
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

        var payload = await api.fetchDocuments(this._fundId);
        model.setProperty("/items", extractItems(payload));
        model.setProperty("/status", "ready");
      } catch (e) {
        model.setProperty("/items", []);
        model.setProperty("/status", "error");
      } finally {
        view.setBusy(false);
      }
    }
  });
});

