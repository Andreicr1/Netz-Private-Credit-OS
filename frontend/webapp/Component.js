sap.ui.define([
  "sap/ui/core/UIComponent",
  "netz/fund/os/model/models"
], function (UIComponent, models) {
  "use strict";

  return UIComponent.extend("netz.fund.os.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      this.setModel(models.createDeviceModel(), "device");

      this.getRouter().initialize();
    }
  });
});
