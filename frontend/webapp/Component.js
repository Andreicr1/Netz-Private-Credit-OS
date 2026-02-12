sap.ui.define([
  "sap/ui/core/UIComponent",
  "netz/fund/os/model/models"
], function (UIComponent, models) {
  "use strict";

  function isStaticWebAppsHost() {
    try {
      var host = (window.location && window.location.hostname) || "";
      return host.indexOf("azurestaticapps.net") !== -1;
    } catch (e) {
      return false;
    }
  }

  function getClientPrincipal(payload) {
    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return null;
      }
      return payload[0] && payload[0].clientPrincipal ? payload[0].clientPrincipal : null;
    }
    return payload && payload.clientPrincipal ? payload.clientPrincipal : null;
  }

  function ensureAuthenticated() {
    if (!isStaticWebAppsHost()) {
      return Promise.resolve(true);
    }

    return fetch("/.auth/me", { method: "GET", credentials: "include" })
      .then(function (res) {
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then(function (payload) {
        var principal = getClientPrincipal(payload);
        if (principal) {
          return true;
        }
        var currentPath = (window.location.pathname || "/") + (window.location.search || "") + (window.location.hash || "");
        window.location.replace("/.auth/login/aad?post_login_redirect_uri=" + encodeURIComponent(currentPath));
        return false;
      })
      .catch(function () {
        var currentPath = (window.location.pathname || "/") + (window.location.search || "") + (window.location.hash || "");
        window.location.replace("/.auth/login/aad?post_login_redirect_uri=" + encodeURIComponent(currentPath));
        return false;
      });
  }

  return UIComponent.extend("netz.fund.os.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      this.setModel(models.createDeviceModel(), "device");

      var router = this.getRouter();
      ensureAuthenticated().then(function (ok) {
        if (ok) {
          router.initialize();
        }
      });
    }
  });
});
