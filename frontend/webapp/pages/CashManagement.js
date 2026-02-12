import * as cashApi from "../api/cash.js";
import { BankStatementUploadDialog } from "../workflows/BankStatementUploadDialog.js";
import { SignatureRequestDialog } from "../workflows/SignatureRequestDialog.js";

function formatUsd(amount) {
  if (amount == null || amount === "") return "";
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export class CashManagementPage {
  constructor({ fundId, onNavigate }) {
    this.fundId = fundId;
    this.onNavigate = onNavigate;

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const t = document.createElement("ui5-title");
    t.level = "H1";
    t.textContent = "Cash Management";
    title.appendChild(t);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const bar = document.createElement("ui5-bar");

    this.newTransferBtn = document.createElement("ui5-button");
    this.newTransferBtn.icon = "add";
    this.newTransferBtn.textContent = "New Transfer Request";
    this.newTransferBtn.design = "Emphasized";
    this.newTransferBtn.disabled = true;
    this.newTransferBtn.title = "Create transaction UI is not yet wired in this refactor.";

    this.uploadStmtBtn = document.createElement("ui5-button");
    this.uploadStmtBtn.icon = "upload";
    this.uploadStmtBtn.textContent = "Upload Statement for Reconciliation";
    this.uploadStmtBtn.addEventListener("click", () => {
      const dlg = new BankStatementUploadDialog({
        fundId: this.fundId,
        onUploaded: () => this._load(),
      });
      dlg.open();
    });

    this.sendToSigBtn = document.createElement("ui5-button");
    this.sendToSigBtn.design = "Emphasized";
    this.sendToSigBtn.textContent = "Send to Signature";
    this.sendToSigBtn.disabled = true;
    this.sendToSigBtn.addEventListener("click", () => this._openSignatureDialog());

    bar.appendChild(this.newTransferBtn);
    bar.appendChild(this.uploadStmtBtn);
    bar.appendChild(this.sendToSigBtn);
    header.appendChild(bar);
    this.el.appendChild(header);

    this._busy = document.createElement("ui5-busy-indicator");
    this._busy.active = true;
    this._busy.style.width = "100%";

    const content = document.createElement("div");
    content.style.padding = "1rem";
    content.style.display = "grid";
    content.style.gap = "0.75rem";

    this._error = document.createElement("ui5-message-strip");
    this._error.design = "Negative";
    this._error.hideCloseButton = false;
    this._error.style.display = "none";
    content.appendChild(this._error);

    this.table = document.createElement("ui5-table");
    this.table.noDataText = "No transfer requests";
    this.table.mode = "SingleSelect";
    this.table.addEventListener("selection-change", (e) => {
      const row = e.detail?.selectedRows?.[0];
      this._selected = row ? row._tx : null;
      this.sendToSigBtn.disabled = !this._selected;
    });
    this.table.addEventListener("row-click", (e) => {
      const row = e.detail?.row;
      const tx = row?._tx;
      if (tx?.id) {
        // Transfer detail view not specified beyond row click; route to signature detail when needed.
        this._selected = tx;
      }
    });

    const cols = [
      "Request ID",
      "Type",
      "Amount (USD)",
      "Justification Clause",
      "Status",
      "Last Updated",
    ];
    cols.forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.table.appendChild(col);
    });

    content.appendChild(this.table);
    this._busy.appendChild(content);
    this.el.appendChild(this._busy);
  }

  onShow() {
    this._load();
  }

  async _load() {
    this._busy.active = true;
    this._error.style.display = "none";
    this.table.replaceChildren(...Array.from(this.table.querySelectorAll("ui5-table-row")));

    if (!this.fundId) {
      this._error.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this._error.style.display = "block";
      this._busy.active = false;
      return;
    }

    try {
      const page = await cashApi.listTransactions(this.fundId, {});
      const items = page?.items ?? page ?? [];
      this._renderRows(Array.isArray(items) ? items : []);
    } catch (e) {
      this._error.textContent = e?.message ? String(e.message) : "Failed to load transfers";
      this._error.style.display = "block";
    } finally {
      this._busy.active = false;
    }
  }

  _renderRows(items) {
    // Clear existing rows (keep columns)
    const rows = Array.from(this.table.querySelectorAll("ui5-table-row"));
    rows.forEach((r) => r.remove());

    items.forEach((tx) => {
      const row = document.createElement("ui5-table-row");
      row._tx = tx;

      const cells = [
        tx.id ?? "",
        tx.type ?? "",
        formatUsd(tx.amount_usd),
        tx.justification_type ? `${tx.justification_type}${tx.justification_document_id ? `: ${tx.justification_document_id}` : ""}` : "",
        tx.status ?? "",
        tx.updated_at ?? "",
      ];
      cells.forEach((v) => {
        const cell = document.createElement("ui5-table-cell");
        cell.textContent = v;
        row.appendChild(cell);
      });
      this.table.appendChild(row);
    });
  }

  _openSignatureDialog() {
    if (!this._selected) {
      return;
    }
    const dlg = new SignatureRequestDialog({
      fundId: this.fundId,
      transfer: this._selected,
      onSubmitted: () => {
        // Hidden route for signature detail
        if (this._selected?.id) {
          this.onNavigate(`/cash/signature/${encodeURIComponent(this._selected.id)}`);
        }
      },
    });
    dlg.open();
  }
}
