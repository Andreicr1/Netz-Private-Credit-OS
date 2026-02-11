sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "netz/fund/os/api/cash"
], function (Controller, JSONModel, MessageToast, MessageBox, cashApi) {
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
    return [];
  }

  function toErrorMessage(err) {
    if (!err) {
      return "Unknown error";
    }
    if (err.message) {
      return String(err.message);
    }
    return String(err);
  }

  return Controller.extend("netz.fund.os.pages.CashManagement", {
    onInit: function () {
      this._fundId = getFundIdFromUrl();
      this._statementFile = null;
      this.getView().setModel(new JSONModel({
        status: "idle",
        errorMessage: "",
        transactions: [],
        statements: [],
        selectedStatementId: "",
        lines: [],
        selectedLineId: "",
        selectedLineStatus: "",
        selectedTxId: "",
        notes: "",
        upload: {
          period_start: "",
          period_end: "",
          fileName: "",
          notes: ""
        }
      }), "cash");

      this._loadTransactionsAndStatements();
    },

    onStatementFileChange: function (oEvent) {
      var model = this.getView().getModel("cash");
      var files = oEvent.getParameter("files");
      var file = files && files.length ? files[0] : null;

      this._statementFile = file;
      model.setProperty("/upload/fileName", file ? file.name : "");
    },

    onUploadStatement: async function () {
      var view = this.getView();
      var model = view.getModel("cash");
      var ps = model.getProperty("/upload/period_start");
      var pe = model.getProperty("/upload/period_end");
      var notes = model.getProperty("/upload/notes");

      if (!ps || !pe) {
        MessageBox.error("Period Start and Period End are required.");
        return;
      }
      if (!this._statementFile) {
        MessageBox.error("Choose a statement file first.");
        return;
      }

      try {
        view.setBusy(true);
        model.setProperty("/status", "loading");
        model.setProperty("/errorMessage", "");

        var res = await cashApi.uploadStatement(this._fundId, {
          period_start: ps,
          period_end: pe,
          notes: notes,
          file: this._statementFile
        });

        MessageToast.show("Statement uploaded.");

        // Refresh statements and select the uploaded one if provided.
        await this._loadStatementsAndMaybeLines();
        if (res && res.statement_id) {
          model.setProperty("/selectedStatementId", String(res.statement_id));
          await this._loadLines(String(res.statement_id));
        }

        // Clear upload state
        this._statementFile = null;
        model.setProperty("/upload/fileName", "");
        model.setProperty("/upload/notes", "");
      } catch (e) {
        model.setProperty("/status", "error");
        model.setProperty("/errorMessage", toErrorMessage(e));
      } finally {
        view.setBusy(false);
      }
    },

    onRefreshTransactions: function () {
      this._loadTransactions();
    },

    onRefreshReconciliation: function () {
      this._loadStatementsAndMaybeLines();
    },

    onStatementChange: function (oEvent) {
      var statementId = oEvent.getSource().getSelectedKey();
      var model = this.getView().getModel("cash");

      model.setProperty("/selectedStatementId", statementId);
      model.setProperty("/lines", []);
      model.setProperty("/selectedLineId", "");
      model.setProperty("/selectedLineStatus", "");

      if (statementId) {
        this._loadLines(statementId);
      }
    },

    onStatementRowSelect: function (oEvent) {
      var item = oEvent.getParameter("listItem") || oEvent.getSource().getSelectedItem();
      var ctx = item ? item.getBindingContext("cash") : null;
      var model = this.getView().getModel("cash");

      var statementId = ctx ? ctx.getProperty("id") : "";
      if (!statementId) {
        return;
      }

      model.setProperty("/selectedStatementId", statementId);
      model.setProperty("/lines", []);
      model.setProperty("/selectedLineId", "");
      model.setProperty("/selectedLineStatus", "");
      this._loadLines(statementId);
    },

    onLineSelect: function (oEvent) {
      var item = oEvent.getParameter("listItem") || oEvent.getSource().getSelectedItem();
      var ctx = item ? item.getBindingContext("cash") : null;
      var model = this.getView().getModel("cash");

      model.setProperty("/selectedLineId", ctx ? ctx.getProperty("id") : "");
      model.setProperty("/selectedLineStatus", ctx ? ctx.getProperty("reconciliation_status") : "");
    },

    onTxSelect: function (oEvent) {
      var item = oEvent.getParameter("listItem") || oEvent.getSource().getSelectedItem();
      var ctx = item ? item.getBindingContext("cash") : null;
      var model = this.getView().getModel("cash");

      model.setProperty("/selectedTxId", ctx ? ctx.getProperty("id") : "");
    },

    onMatch: async function () {
      var view = this.getView();
      var model = view.getModel("cash");
      var lineId = model.getProperty("/selectedLineId");
      var txId = model.getProperty("/selectedTxId");
      var notes = model.getProperty("/notes");

      if (!lineId) {
        MessageBox.error("Select a statement line first.");
        return;
      }
      if (!txId) {
        MessageBox.error("Select a transaction first (Transactions tab).");
        return;
      }

      try {
        view.setBusy(true);
        model.setProperty("/status", "loading");
        model.setProperty("/errorMessage", "");

        await cashApi.manualMatch(this._fundId, {
          statement_line_id: lineId,
          transaction_id: txId,
          reconciliation_status: "MATCHED",
          notes: notes
        });

        MessageToast.show("Matched.");
        var statementId = model.getProperty("/selectedStatementId");
        if (statementId) {
          await this._loadLines(statementId);
        }
        model.setProperty("/notes", "");
      } catch (e) {
        model.setProperty("/status", "error");
        model.setProperty("/errorMessage", toErrorMessage(e));
      } finally {
        view.setBusy(false);
      }
    },

    onFlagDiscrepancy: async function () {
      var view = this.getView();
      var model = view.getModel("cash");
      var lineId = model.getProperty("/selectedLineId");
      var notes = model.getProperty("/notes");

      if (!lineId) {
        MessageBox.error("Select a statement line first.");
        return;
      }

      try {
        view.setBusy(true);
        model.setProperty("/status", "loading");
        model.setProperty("/errorMessage", "");

        await cashApi.manualMatch(this._fundId, {
          statement_line_id: lineId,
          reconciliation_status: "DISCREPANCY",
          notes: notes
        });

        MessageToast.show("Flagged as discrepancy.");
        var statementId = model.getProperty("/selectedStatementId");
        if (statementId) {
          await this._loadLines(statementId);
        }
        model.setProperty("/notes", "");
      } catch (e) {
        model.setProperty("/status", "error");
        model.setProperty("/errorMessage", toErrorMessage(e));
      } finally {
        view.setBusy(false);
      }
    },

    _loadTransactionsAndStatements: async function () {
      await this._loadTransactions();
      await this._loadStatementsAndMaybeLines();
    },

    _loadTransactions: async function () {
      var view = this.getView();
      var model = view.getModel("cash");

      try {
        view.setBusy(true);
        model.setProperty("/status", "loading");
        model.setProperty("/errorMessage", "");

        var txPayload = await cashApi.listTransactions(this._fundId);
        model.setProperty("/transactions", extractItems(txPayload));
        model.setProperty("/status", "ready");
      } catch (e) {
        model.setProperty("/transactions", []);
        model.setProperty("/status", "error");
        model.setProperty("/errorMessage", toErrorMessage(e));
      } finally {
        view.setBusy(false);
      }
    },

    _loadStatementsAndMaybeLines: async function () {
      var view = this.getView();
      var model = view.getModel("cash");

      try {
        view.setBusy(true);
        model.setProperty("/status", "loading");
        model.setProperty("/errorMessage", "");

        var stmtPayload = await cashApi.listStatements(this._fundId);
        var statements = extractItems(stmtPayload);
        model.setProperty("/statements", statements);

        var selectedStatementId = model.getProperty("/selectedStatementId");
        if (!selectedStatementId && statements.length) {
          selectedStatementId = statements[0].id;
          model.setProperty("/selectedStatementId", selectedStatementId);
        }

        if (selectedStatementId) {
          await this._loadLines(selectedStatementId);
        } else {
          model.setProperty("/lines", []);
        }

        model.setProperty("/status", "ready");
      } catch (e) {
        model.setProperty("/statements", []);
        model.setProperty("/lines", []);
        model.setProperty("/status", "error");
        model.setProperty("/errorMessage", toErrorMessage(e));
      } finally {
        view.setBusy(false);
      }
    },

    _loadLines: async function (statementId) {
      var model = this.getView().getModel("cash");
      var payload = await cashApi.listStatementLines(this._fundId, statementId);
      model.setProperty("/lines", extractItems(payload));
      model.setProperty("/selectedLineId", "");
      model.setProperty("/selectedLineStatus", "");
    }
  });
});
