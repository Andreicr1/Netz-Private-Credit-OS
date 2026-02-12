import { uploadStatement } from "../api/cash.js";

export class BankStatementUploadDialog {
  constructor({ fundId, onUploaded }) {
    this.fundId = fundId;
    this.onUploaded = onUploaded;

    this.dialog = document.createElement("ui5-dialog");
    this.dialog.headerText = "Upload Statement for Reconciliation";
    this.dialog.style.width = "48rem";

    const content = document.createElement("div");
    content.style.padding = "1rem";
    content.style.display = "grid";
    content.style.gap = "0.75rem";

    this._msg = document.createElement("ui5-message-strip");
    this._msg.design = "Information";
    this._msg.hideCloseButton = false;
    this._msg.style.display = "none";
    content.appendChild(this._msg);

    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr 1fr";
    row.style.gap = "0.75rem";

    this.periodStart = document.createElement("ui5-date-picker");
    this.periodStart.placeholder = "Period start";
    this.periodEnd = document.createElement("ui5-date-picker");
    this.periodEnd.placeholder = "Period end";
    row.appendChild(this.periodStart);
    row.appendChild(this.periodEnd);
    content.appendChild(row);

    this.notes = document.createElement("ui5-textarea");
    this.notes.placeholder = "Notes (optional)";
    this.notes.rows = 3;
    content.appendChild(this.notes);

    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = ".pdf,.csv,.xls,.xlsx";
    content.appendChild(this.fileInput);

    this.dialog.appendChild(content);

    const footer = document.createElement("div");
    footer.slot = "footer";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "0.5rem";

    const cancel = document.createElement("ui5-button");
    cancel.design = "Transparent";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.close());

    this.uploadBtn = document.createElement("ui5-button");
    this.uploadBtn.design = "Emphasized";
    this.uploadBtn.icon = "upload";
    this.uploadBtn.textContent = "Upload";
    this.uploadBtn.addEventListener("click", () => this._onUpload());

    footer.appendChild(cancel);
    footer.appendChild(this.uploadBtn);
    this.dialog.appendChild(footer);
  }

  open() {
    document.body.appendChild(this.dialog);
    this.dialog.open = true;
  }

  close() {
    this.dialog.open = false;
    this.dialog.remove();
  }

  _showMessage(design, text) {
    this._msg.design = design;
    this._msg.textContent = text;
    this._msg.style.display = "block";
  }

  async _onUpload() {
    if (!this.fundId) {
      this._showMessage("Negative", "No fund scope. Provide ?fundId= in the URL.");
      return;
    }

    const file = this.fileInput.files?.[0];
    const period_start = this.periodStart.value;
    const period_end = this.periodEnd.value;
    const notes = this.notes.value;

    this.uploadBtn.disabled = true;
    try {
      const res = await uploadStatement(this.fundId, { file, period_start, period_end, notes });
      this._showMessage("Positive", "Statement uploaded and registered as evidence for reconciliation.");
      if (this.onUploaded) {
        this.onUploaded(res);
      }
    } catch (e) {
      this._showMessage("Negative", e?.message ? String(e.message) : "Upload failed");
    } finally {
      this.uploadBtn.disabled = false;
    }
  }
}
