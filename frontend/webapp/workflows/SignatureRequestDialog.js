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
    content.style.padding = "1rem";
    content.style.display = "grid";
    content.style.gap = "0.75rem";

    const title = document.createElement("ui5-title");
    title.level = "H3";
    title.textContent = "Execution packet summary";
    content.appendChild(title);

    this._msg = document.createElement("ui5-message-strip");
    this._msg.design = "Information";
    this._msg.hideCloseButton = false;
    this._msg.textContent = "Submitting for director signature is governed server-side. Backend errors are surfaced deterministically.";
    content.appendChild(this._msg);

    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.padding = "0.75rem";
    pre.style.border = "1px solid var(--sapField_BorderColor)";
    pre.style.borderRadius = "0.25rem";
    pre.style.background = "var(--sapBaseColor)";
    pre.textContent = JSON.stringify(
      {
        transfer_id: transfer?.id,
        type: transfer?.type,
        amount_usd: transfer?.amount_usd,
        justification_type: transfer?.justification_type,
        justification_document_id: transfer?.justification_document_id,
        status: transfer?.status,
        updated_at: transfer?.updated_at,
      },
      null,
      2
    );
    content.appendChild(pre);

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

    this.submitBtn = document.createElement("ui5-button");
    this.submitBtn.design = "Emphasized";
    this.submitBtn.textContent = "Send to Signature";
    this.submitBtn.addEventListener("click", () => this._onSubmit());

    footer.appendChild(cancel);
    footer.appendChild(this.submitBtn);
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

  async _onSubmit() {
    const txId = this.transfer?.id;
    if (!this.fundId) {
      this._msg.design = "Negative";
      this._msg.textContent = "No fund scope. Provide ?fundId= in the URL.";
      return;
    }
    if (!txId) {
      this._msg.design = "Negative";
      this._msg.textContent = "No transfer selected.";
      return;
    }

    this.submitBtn.disabled = true;
    try {
      const res = await submitForSignature(this.fundId, txId);
      this._msg.design = "Positive";
      this._msg.textContent = "Submitted for director signature.";
      if (this.onSubmitted) {
        this.onSubmitted(res);
      }
    } catch (e) {
      this._msg.design = "Negative";
      this._msg.textContent = e?.message ? String(e.message) : "Submit failed";
    } finally {
      this.submitBtn.disabled = false;
    }
  }
}
