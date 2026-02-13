import * as cashApi from "../api/cash.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function firstTransactionId(payload) {
  const items = payload?.items;
  if (Array.isArray(items) && items.length > 0 && items[0]?.id) {
    return String(items[0].id);
  }
  return "";
}

export class CashManagementPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.selectedTransactionId = "";

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Cash Management";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Wave 3 placeholder: list transactions, create, mark executed, and reconcile using real cash endpoints.";
    header.appendChild(strip);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = false;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";

    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";
    content.appendChild(this.error);

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexWrap = "wrap";
    controls.style.gap = "0.5rem";
    controls.style.marginBottom = "0.75rem";

    this.transactionIdInput = document.createElement("ui5-input");
    this.transactionIdInput.placeholder = "Transaction ID";
    this.transactionIdInput.style.minWidth = "24rem";

    this.statementIdInput = document.createElement("ui5-input");
    this.statementIdInput.placeholder = "Statement ID (for reconcile)";
    this.statementIdInput.style.minWidth = "24rem";

    this.amountInput = document.createElement("ui5-input");
    this.amountInput.placeholder = "Amount USD";
    this.amountInput.type = "Number";

    this.counterpartyInput = document.createElement("ui5-input");
    this.counterpartyInput.placeholder = "Counterparty";
    this.counterpartyInput.style.minWidth = "18rem";

    this.justificationDocInput = document.createElement("ui5-input");
    this.justificationDocInput.placeholder = "Justification Document ID";
    this.justificationDocInput.style.minWidth = "18rem";

    this.refreshButton = document.createElement("ui5-button");
    this.refreshButton.design = "Emphasized";
    this.refreshButton.textContent = "List Transactions";
    this.refreshButton.addEventListener("click", () => this.onShow());

    this.createButton = document.createElement("ui5-button");
    this.createButton.textContent = "Create Transaction";
    this.createButton.addEventListener("click", () => this.createTransaction());

    this.markExecutedButton = document.createElement("ui5-button");
    this.markExecutedButton.textContent = "Mark Executed";
    this.markExecutedButton.addEventListener("click", () => this.markExecuted());

    this.reconcileButton = document.createElement("ui5-button");
    this.reconcileButton.textContent = "Reconcile";
    this.reconcileButton.addEventListener("click", () => this.reconcile());

    controls.append(
      this.transactionIdInput,
      this.statementIdInput,
      this.amountInput,
      this.counterpartyInput,
      this.justificationDocInput,
      this.refreshButton,
      this.createButton,
      this.markExecutedButton,
      this.reconcileButton,
    );

    this.transactionsPre = document.createElement("pre");
    this.transactionsPre.style.padding = "0.75rem";
    this.transactionsPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.reconciliationPre = document.createElement("pre");
    this.reconciliationPre.style.padding = "0.75rem";
    this.reconciliationPre.style.border = "1px solid var(--sapList_BorderColor)";

    content.append(controls, this.transactionsPre, this.reconciliationPre);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _setError(message) {
    this.error.textContent = message;
    this.error.style.display = "block";
  }

  _clearError() {
    this.error.style.display = "none";
    this.error.textContent = "";
  }

  _effectiveTransactionId() {
    return String(this.transactionIdInput.value || this.selectedTransactionId || "").trim();
  }

  async onShow() {
    this.busy.active = true;
    this._clearError();

    if (!this.fundId) {
      this._setError("No fund scope. Provide ?fundId= in the URL.");
      this.busy.active = false;
      return;
    }

    try {
      const [transactions, report] = await Promise.all([
        cashApi.listCashTransactions(this.fundId),
        cashApi.getCashReconciliationReport(this.fundId),
      ]);

      this.selectedTransactionId = firstTransactionId(transactions);
      if (!this.transactionIdInput.value && this.selectedTransactionId) {
        this.transactionIdInput.value = this.selectedTransactionId;
      }

      this.transactionsPre.textContent = pretty(transactions);
      this.reconciliationPre.textContent = pretty(report);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load cash data");
    } finally {
      this.busy.active = false;
    }
  }

  async createTransaction() {
    this.busy.active = true;
    this._clearError();
    try {
      await cashApi.createCashTransaction(this.fundId, {
        type: "EXPENSE",
        direction: "OUTFLOW",
        amount_usd: Number(this.amountInput.value || 0),
        counterparty: String(this.counterpartyInput.value || "Counterparty Placeholder"),
        justification_type: "OM_CLAUSE",
        justification_document_id: String(this.justificationDocInput.value || "DOC-PLACEHOLDER"),
        notes: "Wave 3 placeholder create",
      });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to create transaction");
    } finally {
      this.busy.active = false;
    }
  }

  async markExecuted() {
    const transactionId = this._effectiveTransactionId();
    if (!transactionId) {
      this._setError("Provide a transaction id to mark executed.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      await cashApi.markCashTransactionExecuted(this.fundId, transactionId, {
        bank_reference: `BANK-${Date.now()}`,
        notes: "Wave 3 placeholder mark executed",
      });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to mark transaction executed");
    } finally {
      this.busy.active = false;
    }
  }

  async reconcile() {
    const statementId = String(this.statementIdInput.value || "").trim();
    if (!statementId) {
      this._setError("Provide a statement id to run reconciliation.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      const result = await cashApi.runCashReconciliation(this.fundId, {
        statement_id: statementId,
        date_tolerance_days: 5,
      });
      this.reconciliationPre.textContent = pretty(result);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to run reconciliation");
    } finally {
      this.busy.active = false;
    }
  }
}
