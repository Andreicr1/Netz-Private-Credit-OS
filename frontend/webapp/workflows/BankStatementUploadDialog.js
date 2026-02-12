import { uploadStatement } from "../api/cash.js";

export class BankStatementUploadDialog {
  constructor({ fundId, onUploaded }) {
    this.fundId = fundId;
    this.onUploaded = onUploaded;

    this.dialog = document.createElement("ui5-dialog");
    this.dialog.headerText = "Upload Statement for Reconciliation";
    this.dialog.style.width = "48rem";

    const content = document.createElement("div");
    content.className = "netz-dialog-content netz-form-grid";

    this.msg = document.createElement("ui5-message-strip");
    this.msg.design = "Information";
    this.msg.hideCloseButton = false;
    this.msg.style.display = "none";
    content.appendChild(this.msg);

    const row = document.createElement("div");
    row.className = "netz-form-grid-two";

    this.periodStart = document.createElement("ui5-date-picker");
    this.periodStart.placeholder = "Period start";
    this.periodEnd = document.createElement("ui5-date-picker");
    this.periodEnd.placeholder = "Period end";
    row.append(this.periodStart, this.periodEnd);
    content.appendChild(row);

    this.notes = document.createElement("ui5-textarea");
    this.notes.placeholder = "Notes (optional)";
    this.notes.rows = 3;
    content.appendChild(this.notes);

    this.file = document.createElement("input");
    this.file.type = "file";
    this.file.accept = ".pdf,.csv,.xls,.xlsx";
    content.appendChild(this.file);

    this.dialog.appendChild(content);

    const footer = document.createElement("div");
    footer.slot = "footer";
    footer.className = "netz-dialog-footer";

    const cancel = document.createElement("ui5-button");
    cancel.design = "Transparent";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.close());

    this.uploadBtn = document.createElement("ui5-button");
    this.uploadBtn.design = "Emphasized";
    this.uploadBtn.icon = "upload";
    this.uploadBtn.textContent = "Upload";
    this.uploadBtn.addEventListener("click", () => this._upload());

    footer.append(cancel, this.uploadBtn);
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

  _show(design, text) {
    this.msg.design = design;
    this.msg.textContent = text;
    this.msg.style.display = "block";
  }

  async _upload() {
    if (!this.fundId) {
      this._show("Negative", "No fund scope. Provide ?fundId= in the URL.");
      return;
    }
    this.uploadBtn.disabled = true;
    try {
      const res = await uploadStatement(this.fundId, {
        file: this.file.files?.[0],
        period_start: this.periodStart.value,
        period_end: this.periodEnd.value,
        notes: this.notes.value
      });
      this._show("Positive", "Statement uploaded and registered for reconciliation.");
      if (this.onUploaded) this.onUploaded(res);
    } catch (e) {
      this._show("Negative", e?.message ? String(e.message) : "Upload failed");
    } finally {
      this.uploadBtn.disabled = false;
    }
  }
}
