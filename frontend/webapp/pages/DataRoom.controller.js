sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/ui/Device",
  "netz/fund/os/services/api"
], function (Controller, JSONModel, MessageToast, Device, api) {
  "use strict";

  function getFundIdFromUrl() {
    try {
      var url = new URL(window.location.href);
      return url.searchParams.get("fundId") || url.searchParams.get("fund_id") || "";
    } catch (e) {
      return "";
    }
  }

  function fmtSize(size) {
    if (size === null || typeof size === "undefined") {
      return "—";
    }
    var value = Number(size);
    if (!isFinite(value) || value < 0) {
      return "—";
    }
    if (value < 1024) {
      return value + " B";
    }
    if (value < 1024 * 1024) {
      return (value / 1024).toFixed(1) + " KB";
    }
    if (value < 1024 * 1024 * 1024) {
      return (value / (1024 * 1024)).toFixed(1) + " MB";
    }
    return (value / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function fmtDate(iso) {
    if (!iso) {
      return "—";
    }
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return String(iso);
    }
  }

  function normalizeFolderPath(path) {
    var p = String(path || "").replace(/^\/+/, "");
    if (p && !/\/$/.test(p)) {
      p += "/";
    }
    return p;
  }

  function buildBreadcrumbs(path) {
    var breadcrumbs = [{ text: "Data Room", path: "" }];
    var current = "";
    var normalized = normalizeFolderPath(path);
    if (!normalized) {
      return breadcrumbs;
    }
    normalized.split("/").filter(Boolean).forEach(function (segment) {
      current += segment + "/";
      breadcrumbs.push({ text: segment, path: current });
    });
    return breadcrumbs;
  }

  function toTableRows(items) {
    var rows = [];
    (items || []).forEach(function (item) {
      var kind = item && item.kind ? item.kind : "file";
      rows.push({
        id: item.id,
        name: item.name,
        kind: kind,
        path: item.path,
        mimeType: kind === "folder" ? "Folder" : (item.mimeType || "File"),
        size: item.size,
        sizeLabel: kind === "folder" ? "—" : fmtSize(item.size),
        lastModified: item.lastModified,
        lastModifiedLabel: kind === "folder" ? "—" : fmtDate(item.lastModified),
        accessLabel: item.accessLabel || "External Eligible",
        children: []
      });
    });
    return rows;
  }

  function roleSetFromMe(payload) {
    var roles = [];
    if (payload && Array.isArray(payload.roles)) {
      roles = payload.roles;
    }
    return roles.map(function (r) {
      return String(r || "").toUpperCase();
    });
  }

  function permissionsFromRoles(roles) {
    var uploadAllowed = ["ADMIN", "GP", "COMPLIANCE", "INVESTMENT_TEAM"];
    var downloadAllowed = ["ADMIN", "GP", "COMPLIANCE", "INVESTMENT_TEAM", "AUDITOR"];
    var canUpload = roles.some(function (r) {
      return uploadAllowed.indexOf(r) >= 0;
    });
    var canDownload = roles.some(function (r) {
      return downloadAllowed.indexOf(r) >= 0;
    });
    return { canUpload: canUpload, canDownload: canDownload };
  }

  function governanceMessage(payload) {
    if (!payload) {
      return "";
    }
    var quality = payload.dataQuality;
    var latency = payload.dataLatency;
    if (quality && String(quality).toUpperCase() !== "OK") {
      return "Data quality warning: " + quality;
    }
    if (typeof latency === "number" && latency > 300) {
      return "Data latency warning: " + latency + "ms";
    }
    return "";
  }

  return Controller.extend("netz.fund.os.pages.DataRoom", {
    onInit: function () {
      this.getView().setModel(new JSONModel({
        status: "idle",
        errorMessage: "",
        governanceWarningVisible: false,
        governanceMessage: "",
        permissions: {
          canUpload: true,
          canDownload: true
        },
        asOf: "",
        currentPath: "",
        currentPathDisplay: "/",
        breadcrumbs: [{ text: "Data Room", path: "" }],
        folders: [],
        tableRows: [],
        totals: { folders: 0, files: 0 },
        selectedDocument: null,
        upload: {
          selectedFileName: "",
          inProgress: false,
          progressPercent: 0,
          progressVisible: false,
          message: "",
          messageType: "Information"
        }
      }), "dataroom");

      this._fundId = getFundIdFromUrl();
      this._selectedFile = null;
      this._loadInitial();
    },

    onRefresh: function () {
      this._loadList(this._model().getProperty("/currentPath"));
    },

    _model: function () {
      return this.getView().getModel("dataroom");
    },

    _setError: function (err) {
      var model = this._model();
      model.setProperty("/status", "error");
      model.setProperty("/errorMessage", (err && err.message) ? String(err.message) : "Failed to load Data Room.");
    },

    _applyGovernance: function (payload) {
      var model = this._model();
      model.setProperty("/asOf", payload && payload.asOf ? payload.asOf : "");
      var msg = governanceMessage(payload);
      model.setProperty("/governanceMessage", msg);
      model.setProperty("/governanceWarningVisible", !!msg);
    },

    _getJson: function (path) {
      return api.fetchJson(api.getBaseUrl() + path, { method: "GET" });
    },

    _loadInitial: async function () {
      var model = this._model();
      var view = this.getView();
      try {
        view.setBusy(true);
        model.setProperty("/status", "loading");
        model.setProperty("/errorMessage", "");

        if (this._fundId) {
          try {
            var me = await api.getComplianceMe(this._fundId);
            var roles = roleSetFromMe(me);
            model.setProperty("/permissions", permissionsFromRoles(roles));
          } catch (e) {
            model.setProperty("/permissions", { canUpload: false, canDownload: true });
          }
        }

        var treePayload = await this._getJson("/data-room/tree");
        this._applyGovernance(treePayload);
        var folders = treePayload && Array.isArray(treePayload.folders) ? treePayload.folders : [];
        model.setProperty("/folders", folders);

        await this._loadList("");
      } catch (e) {
        this._setError(e);
      } finally {
        view.setBusy(false);
      }
    },

    _loadList: async function (path) {
      var model = this._model();
      var view = this.getView();
      var normalizedPath = normalizeFolderPath(path);

      try {
        view.setBusy(true);
        model.setProperty("/status", "loading");
        model.setProperty("/errorMessage", "");
        model.setProperty("/currentPath", normalizedPath);
        model.setProperty("/currentPathDisplay", normalizedPath || "/");
        model.setProperty("/breadcrumbs", buildBreadcrumbs(normalizedPath));

        var payload = await this._getJson("/data-room/list?path=" + encodeURIComponent(normalizedPath));
        this._applyGovernance(payload);
        var items = payload && Array.isArray(payload.items) ? payload.items : [];
        model.setProperty("/tableRows", toTableRows(items));
        model.setProperty("/totals", payload && payload.totals ? payload.totals : { folders: 0, files: 0 });
        model.setProperty("/selectedDocument", null);
        model.setProperty("/status", "ready");
      } catch (e) {
        this._setError(e);
      } finally {
        view.setBusy(false);
      }
    },

    _selectFileForPreview: async function (row) {
      var model = this._model();
      if (!row || row.kind !== "file") {
        return;
      }

      var payload = await this._getJson("/data-room/file-link?path=" + encodeURIComponent(row.path));
      this._applyGovernance(payload);
      model.setProperty("/selectedDocument", {
        id: row.id,
        name: row.name,
        path: row.path,
        mimeType: row.mimeType,
        size: row.size,
        sizeLabel: row.sizeLabel,
        lastModified: row.lastModified,
        lastModifiedLabel: row.lastModifiedLabel,
        accessLabel: row.accessLabel,
        signedViewUrl: payload.signedViewUrl || "",
        signedDownloadUrl: payload.signedDownloadUrl || ""
      });

      var isTabletOrMobileViewport = false;
      try {
        isTabletOrMobileViewport = typeof window !== "undefined" && window.innerWidth <= 1024;
      } catch (e) {
        isTabletOrMobileViewport = false;
      }

      if (!Device.system.desktop || isTabletOrMobileViewport) {
        this.byId("previewDialog").open();
      }
    },

    _getRowFromEvent: function (evt) {
      var ctx = evt.getSource().getBindingContext("dataroom");
      return ctx ? ctx.getObject() : null;
    },

    onFolderPress: function (evt) {
      var ctx = evt.getSource().getBindingContext("dataroom");
      if (!ctx) {
        return;
      }
      var node = ctx.getObject();
      this._loadList(node.path);
    },

    onFolderSelectionChange: function (evt) {
      var item = evt.getParameter("listItem");
      if (!item) {
        return;
      }
      var ctx = item.getBindingContext("dataroom");
      if (!ctx) {
        return;
      }
      var node = ctx.getObject();
      this._loadList(node.path);
    },

    onTableRowSelectionChange: function (evt) {
      var rowContext = evt.getParameter("rowContext");
      if (!rowContext) {
        return;
      }
      var row = rowContext.getObject();
      if (!row) {
        return;
      }
      if (row.kind === "folder") {
        this._loadList(row.path);
        return;
      }
      this._selectFileForPreview(row).catch(this._setError.bind(this));
    },

    onOpenRow: function (evt) {
      var row = this._getRowFromEvent(evt);
      if (!row) {
        return;
      }
      if (row.kind === "folder") {
        this._loadList(row.path);
        return;
      }
      this._selectFileForPreview(row).catch(this._setError.bind(this));
    },

    onDownloadRow: function (evt) {
      var row = this._getRowFromEvent(evt);
      if (!row || row.kind !== "file") {
        return;
      }
      this._getJson("/data-room/file-link?path=" + encodeURIComponent(row.path))
        .then(function (payload) {
          if (payload && payload.signedDownloadUrl) {
            window.open(payload.signedDownloadUrl, "_blank", "noopener,noreferrer");
          }
        })
        .catch(this._setError.bind(this));
    },

    onToolbarDownload: function () {
      var selected = this._model().getProperty("/selectedDocument");
      if (!selected || !selected.signedDownloadUrl) {
        return;
      }
      window.open(selected.signedDownloadUrl, "_blank", "noopener,noreferrer");
    },

    onOpenInNewTab: function () {
      var selected = this._model().getProperty("/selectedDocument");
      if (!selected || !selected.signedViewUrl) {
        return;
      }
      window.open(selected.signedViewUrl, "_blank", "noopener,noreferrer");
    },

    onClosePreviewDialog: function () {
      this.byId("previewDialog").close();
    },

    onBreadcrumbPress: function (evt) {
      var ctx = evt.getSource().getBindingContext("dataroom");
      if (!ctx) {
        return;
      }
      var crumb = ctx.getObject();
      this._loadList(crumb.path || "");
    },

    onOpenUploadDialog: function () {
      var dialog = this.byId("uploadDialog");
      var model = this._model();
      model.setProperty("/upload/selectedFileName", "");
      model.setProperty("/upload/inProgress", false);
      model.setProperty("/upload/progressPercent", 0);
      model.setProperty("/upload/progressVisible", false);
      model.setProperty("/upload/message", "");
      model.setProperty("/upload/messageType", "Information");
      this._selectedFile = null;
      dialog.open();
    },

    onCloseUploadDialog: function () {
      this.byId("uploadDialog").close();
    },

    onUploadSelectionChange: function (evt) {
      var files = evt.getParameter("files");
      this._selectedFile = files && files.length ? files[0] : null;
      this._model().setProperty("/upload/selectedFileName", this._selectedFile ? this._selectedFile.name : "");
    },

    onConfirmUpload: function () {
      var model = this._model();
      if (!this._selectedFile) {
        model.setProperty("/upload/message", "Select a file before upload.");
        model.setProperty("/upload/messageType", "Warning");
        return;
      }
      if (!this._fundId) {
        model.setProperty("/upload/message", "Missing fundId in URL.");
        model.setProperty("/upload/messageType", "Error");
        return;
      }

      var currentPath = model.getProperty("/currentPath") || "";
      var form = new FormData();
      form.append("fund_id", this._fundId);
      form.append("path", currentPath);
      form.append("file", this._selectedFile, this._selectedFile.name || "document");

      model.setProperty("/upload/inProgress", true);
      model.setProperty("/upload/progressVisible", true);
      model.setProperty("/upload/progressPercent", 10);
      model.setProperty("/upload/message", "Uploading...");
      model.setProperty("/upload/messageType", "Information");

      api.postForm(api.getBaseUrl() + "/data-room/upload", form)
        .then(function (payload) {
          model.setProperty("/upload/progressPercent", 100);
          model.setProperty("/upload/inProgress", false);
          model.setProperty("/upload/message", "Upload completed successfully.");
          model.setProperty("/upload/messageType", "Success");
          MessageToast.show("Document uploaded.");
          if (payload && payload.item) {
            var selected = payload.item;
            selected.sizeLabel = fmtSize(selected.size);
            selected.lastModifiedLabel = fmtDate(selected.lastModified);
            model.setProperty("/selectedDocument", selected);
          }
        })
        .then(function () {
          return this._loadList(currentPath);
        }.bind(this))
        .then(function () {
          this.byId("uploadDialog").close();
          model.setProperty("/upload/progressVisible", false);
          model.setProperty("/upload/progressPercent", 0);
        }.bind(this))
        .catch(function (err) {
          model.setProperty("/upload/inProgress", false);
          model.setProperty("/upload/progressVisible", false);
          model.setProperty("/upload/progressPercent", 0);
          model.setProperty("/upload/message", (err && err.message) ? String(err.message) : "Upload failed.");
          model.setProperty("/upload/messageType", "Error");
        });
    }
  });
});

