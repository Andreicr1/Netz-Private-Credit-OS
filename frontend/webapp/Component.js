sap.ui.define([
  "sap/ui/core/UIComponent",
  "netz/fund/os/model/models",
  "netz/fund/os/services/api"
], function (UIComponent, models, api) {
  "use strict";

  return UIComponent.extend("netz.fund.os.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      this.setModel(models.createDeviceModel(), "device");

      var router = this.getRouter();
      api.ensureAuthenticated().then(function (ok) {
        if (ok) {
          router.initialize();
        }
      });
    }
  });
});
