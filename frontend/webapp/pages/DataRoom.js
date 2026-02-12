import * as documentsApi from "../api/documents.js";
import * as complianceApi from "../api/compliance.js";

export class DataRoomPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Data Room";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const bar = document.createElement("ui5-bar");
    bar.className = "netz-action-bar";
    bar.accessibleName = "Data room actions";

    this.uploadBtn = document.createElement("ui5-button");
    this.uploadBtn.slot = "endContent";
    this.uploadBtn.className = "netz-action-btn";
    this.uploadBtn.design = "Emphasized";
    this.uploadBtn.icon = "upload";
    this.uploadBtn.textContent = "Upload PDF";
    this.uploadBtn.addEventListener("click", () => this._openUploadDialog());

    this.createRootBtn = document.createElement("ui5-button");
    this.createRootBtn.slot = "endContent";
    this.createRootBtn.className = "netz-action-btn";
    this.createRootBtn.design = "Default";
    this.createRootBtn.icon = "add";
    this.createRootBtn.textContent = "Create Root Folder";
    this.createRootBtn.disabled = true;
    this.createRootBtn.addEventListener("click", () => this._openCreateRootDialog());

    bar.append(this.uploadBtn, this.createRootBtn);
    header.appendChild(bar);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = true;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";

    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";
    content.appendChild(this.error);

    this.table = document.createElement("ui5-table");
    this.table.className = "netz-table";
    this.table.accessibleName = "Data room documents";
    this.table.overflowMode = "Scroll";
    this.table.loading = false;
    this.table.noDataText = "No documents";
    ["Root Folder", "Title", "Version Count", "Updated At", "Domain"].forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.table.appendChild(col);
    });
    content.appendChild(this.table);

    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  async onShow() {
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
      const me = await complianceApi.me(this.fundId);
      const roles = me?.roles || [];
      this.createRootBtn.disabled = !roles.includes("ADMIN");

      const page = await documentsApi.listDocuments(this.fundId, { limit: 50, offset: 0 });
      (page?.items || []).forEach((doc) => {
        const row = document.createElement("ui5-table-row");
        const cells = [
          doc.root_folder ?? "",
          doc.title ?? "",
          doc.versions_count ?? "",
          doc.updated_at ?? "",
          doc.domain ?? ""
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

  _openUploadDialog() {
    const dlg = document.createElement("ui5-dialog");
    dlg.headerText = "Upload PDF";
    dlg.style.width = "52rem";

    const content = document.createElement("div");
    content.className = "netz-dialog-content netz-form-grid";

    const root = document.createElement("ui5-input");
    root.placeholder = "Root folder";
    const domain = document.createElement("ui5-input");
    domain.placeholder = "Domain";
    const title = document.createElement("ui5-input");
    title.placeholder = "Title (optional)";
    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".pdf,application/pdf";

    const msg = document.createElement("ui5-message-strip");
    msg.design = "Information";
    msg.style.display = "none";

    content.append(root, domain, title, file, msg);
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

    const upload = document.createElement("ui5-button");
    upload.design = "Emphasized";
    upload.textContent = "Upload";
    upload.icon = "upload";
    upload.addEventListener("click", async () => {
      upload.disabled = true;
      try {
        await documentsApi.uploadPdf(this.fundId, {
          root_folder: root.value,
          domain: domain.value,
          title: title.value,
          file: file.files?.[0]
        });
        msg.design = "Positive";
        msg.textContent = "Uploaded.";
        msg.style.display = "block";
        await this.onShow();
      } catch (e) {
        msg.design = "Negative";
        msg.textContent = e?.message ? String(e.message) : "Upload failed";
        msg.style.display = "block";
      } finally {
        upload.disabled = false;
      }
    });

    footer.append(cancel, upload);
    dlg.appendChild(footer);
    document.body.appendChild(dlg);
    dlg.open = true;
  }

  _openCreateRootDialog() {
    const dlg = document.createElement("ui5-dialog");
    dlg.headerText = "Create Root Folder";
    dlg.style.width = "32rem";

    const content = document.createElement("div");
    content.className = "netz-dialog-content netz-form-grid";

    const name = document.createElement("ui5-input");
    name.placeholder = "Folder name";
    const msg = document.createElement("ui5-message-strip");
    msg.style.display = "none";
    content.append(name, msg);
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
      create.disabled = true;
      try {
        await documentsApi.createRootFolder(this.fundId, name.value);
        msg.design = "Positive";
        msg.textContent = "Root folder created.";
        msg.style.display = "block";
        await this.onShow();
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
