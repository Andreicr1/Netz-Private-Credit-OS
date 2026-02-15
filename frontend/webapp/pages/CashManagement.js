import * as cashApi from "../api/cash.js";
import { BankStatementUploadDialog } from "../workflows/BankStatementUploadDialog.js";
import { SignatureRequestDialog } from "../workflows/SignatureRequestDialog.js";

function formatUsd(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount == null ? "" : String(amount);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export class CashManagementPage {
  constructor({ fundId, onNavigate }) {
    this.fundId = fundId;
    this.onNavigate = onNavigate;
    this.selected = null;

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Cash Management";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const bar = document.createElement("ui5-bar");
    bar.className = "netz-action-bar";
    bar.accessibleName = "Cash management actions";

    this.newTransferBtn = document.createElement("ui5-button");
    this.newTransferBtn.slot = "endContent";
    this.newTransferBtn.className = "netz-action-btn";
    this.newTransferBtn.design = "Emphasized";
    this.newTransferBtn.icon = "add";
    this.newTransferBtn.textContent = "New Transfer Request";
    this.newTransferBtn.addEventListener("click", () => this._openNewTransferDialog());

    this.uploadStmtBtn = document.createElement("ui5-button");
    this.uploadStmtBtn.slot = "endContent";
    this.uploadStmtBtn.className = "netz-action-btn";
    this.uploadStmtBtn.design = "Transparent";
    this.uploadStmtBtn.icon = "upload";
    this.uploadStmtBtn.textContent = "Upload Statement (Manual Ingest)";
    this.uploadStmtBtn.addEventListener("click", () => {
      new BankStatementUploadDialog({ fundId: this.fundId, onUploaded: () => this._load() }).open();
    });

    this.sendToSigBtn = document.createElement("ui5-button");
    this.sendToSigBtn.slot = "endContent";
    this.sendToSigBtn.className = "netz-action-btn";
    this.sendToSigBtn.design = "Attention";
    this.sendToSigBtn.icon = "sys-enter-2";
    this.sendToSigBtn.textContent = "Send to Signature";
    this.sendToSigBtn.disabled = true;
    this.sendToSigBtn.addEventListener("click", () => this._openSignatureDialog());

    bar.append(this.newTransferBtn, this.uploadStmtBtn, this.sendToSigBtn);
    header.appendChild(bar);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = true;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";

    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.hideCloseButton = false;
    this.error.style.display = "none";
    content.appendChild(this.error);

    this.table = document.createElement("ui5-table");
    this.table.className = "netz-table";
    this.table.accessibleName = "Cash transfer requests";
    this.table.overflowMode = "Scroll";
    this.table.loading = false;
    this.table.noDataText = "No transfer requests";
    this.table.mode = "SingleSelect";
    this.table.addEventListener("selection-change", (e) => {
      const row = e.detail?.selectedRows?.[0];
      this.selected = row?._tx || null;
      this._syncActions();
    });

    [
      "Request ID",
      "Type (Expense / Investment)",
      "Amount (USD)",
      "Justification Clause",
      "Status (Draft / Ready / Signed / Executed)",
      "Last Updated"
    ].forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.table.appendChild(col);
    });

    content.appendChild(this.table);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  onShow() {
    this._load();
  }

  _syncActions() {
    // Enable Send to Signature only when a row is selected; backend enforces validity.
    this.sendToSigBtn.disabled = !this.selected;
  }

  async _load() {
    this.busy.active = true;
    this.table.loading = true;
    this.error.style.display = "none";
    Array.from(this.table.querySelectorAll("ui5-table-row")).forEach((r) => r.remove());

    if (!this.fundId) {
      this.error.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this.error.style.display = "block";
      this.busy.active = false;
      this.table.loading = false;
      return;
    }

    try {
      const page = await cashApi.listTransactions(this.fundId);
      const items = page?.items ?? page ?? [];
      (Array.isArray(items) ? items : []).forEach((tx) => {
        const row = document.createElement("ui5-table-row");
        row._tx = tx;
        const cells = [
          tx.id ?? "",
          tx.type ?? "",
          formatUsd(tx.amount_usd),
          tx.justification_type ? `${tx.justification_type}${tx.justification_document_id ? `: ${tx.justification_document_id}` : ""}` : "",
          tx.status ?? "",
          tx.updated_at ?? ""
        ];
        cells.forEach((v) => {
          const cell = document.createElement("ui5-table-cell");
          cell.textContent = String(v ?? "");
          row.appendChild(cell);
        });
        this.table.appendChild(row);
      });
    } catch (e) {
      this.error.textContent = e?.message ? String(e.message) : "Failed to load";
      this.error.style.display = "block";
    } finally {
      this.busy.active = false;
      this.table.loading = false;
    }
  }

  _openSignatureDialog() {
    if (!this.selected) return;
    new SignatureRequestDialog({
      fundId: this.fundId,
      transfer: this.selected,
      onSubmitted: () => {
        if (this.selected?.id) {
          this.onNavigate(`/cash/signature/${encodeURIComponent(this.selected.id)}`);
        }
      }
    }).open();
  }

  _openNewTransferDialog() {
    const dlg = document.createElement("ui5-dialog");
    dlg.headerText = "New Transfer Request";
    dlg.style.width = "52rem";

    const content = document.createElement("div");
    content.className = "netz-dialog-content netz-form-grid";

    const msg = document.createElement("ui5-message-strip");
    msg.design = "Information";
    msg.hideCloseButton = false;
    msg.style.display = "none";

    const type = document.createElement("ui5-select");
    ["EXPENSE", "INVESTMENT"].forEach((v) => {
      const opt = document.createElement("ui5-option");
      opt.textContent = v;
      opt.value = v;
      type.appendChild(opt);
    });

    const amount = document.createElement("ui5-input");
    amount.type = "Number";
    amount.placeholder = "Amount (USD)";

    const counterparty = document.createElement("ui5-input");
    counterparty.placeholder = "Counterparty";

    const justificationType = document.createElement("ui5-select");
    ["OM_CLAUSE", "INVESTMENT_MEMO"].forEach((v) => {
      const opt = document.createElement("ui5-option");
      opt.textContent = v;
      opt.value = v;
      justificationType.appendChild(opt);
    });

    const justificationDocId = document.createElement("ui5-input");
    justificationDocId.placeholder = "Justification Document ID";

    const notes = document.createElement("ui5-textarea");
    notes.rows = 3;
    notes.placeholder = "Notes (optional)";

    content.append(type, amount, counterparty, justificationType, justificationDocId, notes, msg);
    dlg.appendChild(content);

    const footer = document.createElement("div");
    footer.slot = "footer";
    footer.className = "netz-dialog-footer";

    const cancel = document.createElement("ui5-button");
    cancel.design = "Transparent";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      dlg.open = false;
      dlg.remove();
    });

    const create = document.createElement("ui5-button");
    create.design = "Emphasized";
    create.icon = "add";
    create.textContent = "Create";
    create.addEventListener("click", async () => {
      if (!this.fundId) {
        msg.design = "Negative";
        msg.textContent = "No fund scope. Provide ?fundId= in the URL.";
        msg.style.display = "block";
        return;
      }
      create.disabled = true;
      try {
        await cashApi.createTransaction(this.fundId, {
          type: type.value,
          direction: "OUTFLOW",
          amount_usd: amount.value,
          counterparty: counterparty.value,
          justification_type: justificationType.value,
          justification_document_id: justificationDocId.value,
          notes: notes.value
        });
        msg.design = "Positive";
        msg.textContent = "Transfer request created.";
        msg.style.display = "block";
        await this._load();
      } catch (e) {
        msg.design = "Negative";
        msg.textContent = e?.message ? String(e.message) : "Create failed";
        msg.style.display = "block";
      } finally {
        create.disabled = false;
      }
    });

    footer.append(cancel, create);
    dlg.appendChild(footer);
    document.body.appendChild(dlg);
    dlg.open = true;
  }
}
