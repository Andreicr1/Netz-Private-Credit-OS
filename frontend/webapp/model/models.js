sap.ui.define(["sap/ui/Device", "sap/ui/model/json/JSONModel"], function (Device, JSONModel) {
  "use strict";

  return {
    createDeviceModel: function () {
      var model = new JSONModel(Device);
      model.setDefaultBindingMode("OneWay");
      return model;
    }
  };
});
