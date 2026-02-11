sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent"
], function (Controller, UIComponent) {
  "use strict";

  function getFundIdFromQuery() {
    var q = new URLSearchParams(window.location.search || "");
    return q.get("fundId") || q.get("fund_id") || "";
  }

  return Controller.extend("netz.fund.os.App", {
    onInit: function () {
      var router = UIComponent.getRouterFor(this);
      router.attachRouteMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (event) {
      var routeName = event.getParameter("name");
      this._syncNavSelection(routeName === "root" ? "dashboard" : routeName);
    },

    _syncNavSelection: function (routeName) {
      var navList = this.byId("navList");
      if (!navList) {
        return;
      }

      var items = navList.getItems();
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var route = this._getRouteFromItem(item);
        if (route === routeName) {
          navList.setSelectedItem(item);
          return;
        }
      }
    },

    _getRouteFromItem: function (item) {
      var customData = item && item.getCustomData ? item.getCustomData() : null;
      if (!customData || !customData.length) {
        return null;
      }
      for (var i = 0; i < customData.length; i++) {
        if (customData[i].getKey && customData[i].getKey() === "route") {
          return customData[i].getValue();
        }
      }
      return null;
    },

    onNavSelectionChange: function (event) {
      var item = event.getParameter("listItem");
      if (!item) {
        return;
      }

      var route = this._getRouteFromItem(item);
      if (!route) {
        return;
      }

      if (route === "signatures") {
        var fundId = getFundIdFromQuery();
        UIComponent.getRouterFor(this).navTo(route, { fundId: fundId || "" });
        return;
      }

      UIComponent.getRouterFor(this).navTo(route);
    }
  });
});

