import * as documentsApi from "../api/documents.js";
import * as complianceApi from "../api/compliance.js";

export class DataRoomPage {
  constructor({ fundId }) {
    this.fundId = fundId;

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const t = document.createElement("ui5-title");
    t.level = "H1";
    t.textContent = "Data Room";
    title.appendChild(t);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const bar = document.createElement("ui5-bar");

    this.uploadBtn = document.createElement("ui5-button");
    this.uploadBtn.design = "Emphasized";
    this.uploadBtn.icon = "upload";
    this.uploadBtn.textContent = "Upload PDF";
    this.uploadBtn.addEventListener("click", () => this._openUploadDialog());

    this.createRootBtn = document.createElement("ui5-button");
    this.createRootBtn.design = "Default";
    this.createRootBtn.textContent = "Create Root Folder";
    this.createRootBtn.disabled = true;
    this.createRootBtn.addEventListener("click", () => this._openCreateRootFolderDialog());

    bar.appendChild(this.uploadBtn);
    bar.appendChild(this.createRootBtn);
    header.appendChild(bar);
    this.el.appendChild(header);

    this._busy = document.createElement("ui5-busy-indicator");
    this._busy.active = true;
    this._busy.style.width = "100%";

    const content = document.createElement("div");
    content.style.padding = "1rem";
    content.style.display = "grid";
    content.style.gap = "0.75rem";

    this._msg = document.createElement("ui5-message-strip");
    this._msg.design = "Information";
    this._msg.hideCloseButton = true;
    this._msg.textContent = "Root folder grouping is backend-governed. Uploads are stored as evidence documents.";
    content.appendChild(this._msg);

    this._error = document.createElement("ui5-message-strip");
    this._error.design = "Negative";
    this._error.hideCloseButton = false;
    this._error.style.display = "none";
    content.appendChild(this._error);

    this.table = document.createElement("ui5-table");
    this.table.noDataText = "No documents";
    this.table.mode = "SingleSelect";

    const cols = ["Root Folder", "Title", "Version Count", "Updated At", "Domain"];
    cols.forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.table.appendChild(col);
    });

    content.appendChild(this.table);
    this._busy.appendChild(content);
    this.el.appendChild(this._busy);

    this._user = null;
  }

  async onShow() {
    this._busy.active = true;
    this._error.style.display = "none";
    if (!this.fundId) {
      this._error.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this._error.style.display = "block";
      this._busy.active = false;
      return;
    }

    try {
      this._user = await complianceApi.me(this.fundId);
      const roles = this._user?.roles || [];
      this.createRootBtn.disabled = !roles.includes("ADMIN");

      const page = await documentsApi.listDocuments(this.fundId, { limit: 50, offset: 0 });
      this._renderRows(page?.items || []);
    } catch (e) {
      this._error.textContent = e?.message ? String(e.message) : "Failed to load documents";
      this._error.style.display = "block";
    } finally {
      this._busy.active = false;
    }
  }

  _renderRows(items) {
    Array.from(this.table.querySelectorAll("ui5-table-row")).forEach((r) => r.remove());
    items.forEach((doc) => {
      const row = document.createElement("ui5-table-row");
      row._doc = doc;
      const cells = [
        doc.root_folder ?? "",
        doc.title ?? "",
        doc.versions_count ?? doc.version_count ?? "",
        doc.updated_at ?? "",
        doc.domain ?? "",
      ];
      cells.forEach((v) => {
        const cell = document.createElement("ui5-table-cell");
        cell.textContent = v;
        row.appendChild(cell);
      });
      this.table.appendChild(row);
    });
  }

  _openUploadDialog() {
    const dlg = document.createElement("ui5-dialog");
    dlg.headerText = "Upload PDF";
    dlg.style.width = "52rem";

    const content = document.createElement("div");
    content.style.padding = "1rem";
    content.style.display = "grid";
    content.style.gap = "0.75rem";

    const root = document.createElement("ui5-input");
    root.placeholder = "Root folder";
    const sub = document.createElement("ui5-input");
    sub.placeholder = "Subfolder path (optional)";
    const domain = document.createElement("ui5-input");
    domain.placeholder = "Domain";
    const title = document.createElement("ui5-input");
    title.placeholder = "Title (optional)";
    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".pdf,application/pdf";

    const msg = document.createElement("ui5-message-strip");
    msg.design = "Information";
    msg.hideCloseButton = false;
    msg.style.display = "none";

    content.append(root, sub, domain, title, file, msg);
    dlg.appendChild(content);

    const footer = document.createElement("div");
    footer.slot = "footer";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "0.5rem";

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
        const res = await documentsApi.uploadPdf(this.fundId, {
          root_folder: root.value,
          subfolder_path: sub.value,
          domain: domain.value,
          title: title.value,
          file: file.files?.[0],
        });
        msg.design = "Positive";
        msg.textContent = "Uploaded.";
        msg.style.display = "block";
        await this.onShow();
        void res;
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

  _openCreateRootFolderDialog() {
    const dlg = document.createElement("ui5-dialog");
    dlg.headerText = "Create Root Folder";
    dlg.style.width = "32rem";

    const content = document.createElement("div");
    content.style.padding = "1rem";
    content.style.display = "grid";
    content.style.gap = "0.75rem";

    const name = document.createElement("ui5-input");
    name.placeholder = "Folder name";
    const msg = document.createElement("ui5-message-strip");
    msg.design = "Information";
    msg.hideCloseButton = false;
    msg.style.display = "none";
    content.append(name, msg);
    dlg.appendChild(content);

    const footer = document.createElement("div");
    footer.slot = "footer";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "0.5rem";

    const cancel = document.createElement("ui5-button");
    cancel.design = "Transparent";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      dlg.open = false;
      dlg.remove();
    });

    const create = document.createElement("ui5-button");
    create.design = "Emphasized";
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
