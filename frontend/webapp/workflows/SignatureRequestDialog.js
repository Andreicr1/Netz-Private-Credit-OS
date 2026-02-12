import { submitForSignature } from "../api/cash.js";

export class SignatureRequestDialog {
  constructor({ fundId, transfer, onSubmitted }) {
    this.fundId = fundId;
    this.transfer = transfer;
    this.onSubmitted = onSubmitted;

    this.dialog = document.createElement("ui5-dialog");
    this.dialog.headerText = "Signature Request";
    this.dialog.style.width = "52rem";

    const content = document.createElement("div");
    content.className = "netz-dialog-content netz-form-grid";

    this.msg = document.createElement("ui5-message-strip");
    this.msg.design = "Information";
    this.msg.hideCloseButton = false;
    this.msg.textContent = "Execution packet submission is governed server-side.";
    content.appendChild(this.msg);

    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.padding = "0.75rem";
    pre.style.border = "1px solid var(--sapField_BorderColor)";
    pre.style.borderRadius = "0.25rem";
    pre.textContent = JSON.stringify(transfer, null, 2);
    content.appendChild(pre);

    this.dialog.appendChild(content);

    const footer = document.createElement("div");
    footer.slot = "footer";
    footer.className = "netz-dialog-footer";

    const cancel = document.createElement("ui5-button");
    cancel.design = "Transparent";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.close());

    this.submitBtn = document.createElement("ui5-button");
    this.submitBtn.design = "Attention";
    this.submitBtn.icon = "sys-enter-2";
    this.submitBtn.textContent = "Send to Signature";
    this.submitBtn.addEventListener("click", () => this._submit());

    footer.append(cancel, this.submitBtn);
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

  async _submit() {
    if (!this.fundId) {
      this.msg.design = "Negative";
      this.msg.textContent = "No fund scope. Provide ?fundId= in the URL.";
      return;
    }
    const txId = this.transfer?.id;
    if (!txId) {
      this.msg.design = "Negative";
      this.msg.textContent = "No transfer selected.";
      return;
    }
    this.submitBtn.disabled = true;
    try {
      const res = await submitForSignature(this.fundId, txId);
      this.msg.design = "Positive";
      this.msg.textContent = "Submitted for signature.";
      if (this.onSubmitted) this.onSubmitted(res);
    } catch (e) {
      this.msg.design = "Negative";
      this.msg.textContent = e?.message ? String(e.message) : "Submit failed";
    } finally {
      this.submitBtn.disabled = false;
    }
  }
}
