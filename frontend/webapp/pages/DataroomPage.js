import * as dataroomApi from "../api/dataroom.js";

/* ── Helpers ── */

function fmtSize(bytes) {
  if (bytes == null) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtDate(iso) {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function displayName(fullPath, isFolder) {
  if (!fullPath) return "\u2014";
  const trimmed = isFolder ? fullPath.replace(/\/$/, "") : fullPath;
  const parts = trimmed.split("/");
  return parts[parts.length - 1] || trimmed;
}

function iconForEntry(entry) {
  if (entry.is_folder) return "folder-blank";
  const name = (entry.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf-attachment";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "doc-attachment";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "excel-attachment";
  if (name.endsWith(".ppt") || name.endsWith(".pptx")) return "ppt-attachment";
  if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "picture";
  return "document";
}

/* ── DataRoom Page ── */

export class DataroomPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.currentPrefix = "";
    this.breadcrumbs = [{ label: "Data Room", prefix: "" }];

    this.el = document.createElement("ui5-dynamic-page");

    /* Page title */
    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Data Room";
    title.appendChild(h);
    this.el.appendChild(title);

    /* Header — breadcrumbs */
    const header = document.createElement("ui5-dynamic-page-header");
    this.breadcrumbBar = document.createElement("div");
    this.breadcrumbBar.className = "netz-dataroom-breadcrumbs";
    header.appendChild(this.breadcrumbBar);
    this.el.appendChild(header);

    /* Busy indicator */
    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = true;
    this.busy.style.width = "100%";

    /* Content */
    this.content = document.createElement("div");
    this.content.className = "netz-page-content netz-dataroom-content";

    /* Error strip */
    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";
    this.content.appendChild(this.error);

    /* Summary bar */
    this.summaryBar = document.createElement("div");
    this.summaryBar.className = "netz-dataroom-summary";
    this.content.appendChild(this.summaryBar);

    /* Table */
    this.tableWrap = document.createElement("div");
    this.tableWrap.className = "netz-dataroom-table-wrap";
    this.content.appendChild(this.tableWrap);

    this.busy.appendChild(this.content);
    this.el.appendChild(this.busy);
  }

  /* ── Breadcrumb rendering ── */

  _renderBreadcrumbs() {
    this.breadcrumbBar.replaceChildren();

    const bc = document.createElement("ui5-breadcrumbs");

    this.breadcrumbs.forEach((crumb, idx) => {
      const item = document.createElement("ui5-breadcrumbs-item");
      item.textContent = crumb.label;
      if (idx < this.breadcrumbs.length - 1) {
        item.href = "#";
        item.addEventListener("click", (e) => {
          e.preventDefault();
          this._navigateTo(crumb.prefix, idx);
        });
      }
      bc.appendChild(item);
    });

    this.breadcrumbBar.appendChild(bc);
  }

  _navigateTo(prefix, breadcrumbIdx) {
    this.currentPrefix = prefix;
    this.breadcrumbs = this.breadcrumbs.slice(0, breadcrumbIdx + 1);
    this.onShow();
  }

  _openFolder(folderPrefix) {
    this.currentPrefix = folderPrefix;
    const name = displayName(folderPrefix, true);
    this.breadcrumbs.push({ label: name, prefix: folderPrefix });
    this.onShow();
  }

  /* ── Error handling ── */

  _setError(message) {
    this.error.textContent = message;
    this.error.style.display = "block";
  }

  _clearError() {
    this.error.style.display = "none";
    this.error.textContent = "";
  }

  /* ── Main load ── */

  async onShow() {
    this.busy.active = true;
    this._clearError();
    this._renderBreadcrumbs();

    try {
      const result = await dataroomApi.browseDataroom({ prefix: this.currentPrefix });
      const items = Array.isArray(result?.items) ? result.items : [];

      /* Sort: folders first, then files, alphabetically */
      items.sort((a, b) => {
        if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
        return (a.name || "").localeCompare(b.name || "");
      });

      const folders = items.filter((i) => i.is_folder);
      const files = items.filter((i) => !i.is_folder);

      /* Summary */
      this.summaryBar.replaceChildren();
      const summaryLabel = document.createElement("ui5-label");
      summaryLabel.textContent = `${folders.length} folder${folders.length !== 1 ? "s" : ""}, ${files.length} file${files.length !== 1 ? "s" : ""}`;
      summaryLabel.className = "netz-dataroom-summary-label";
      this.summaryBar.appendChild(summaryLabel);

      if (this.currentPrefix) {
        const backBtn = document.createElement("ui5-button");
        backBtn.design = "Transparent";
        backBtn.icon = "nav-back";
        backBtn.textContent = "Back";
        backBtn.addEventListener("click", () => {
          if (this.breadcrumbs.length > 1) {
            const parentIdx = this.breadcrumbs.length - 2;
            this._navigateTo(this.breadcrumbs[parentIdx].prefix, parentIdx);
          }
        });
        this.summaryBar.prepend(backBtn);
      }

      /* Render table */
      this.tableWrap.replaceChildren();

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "netz-dataroom-empty";
        const ic = document.createElement("ui5-icon");
        ic.name = "folder-blank";
        ic.className = "netz-dataroom-empty-icon";
        empty.appendChild(ic);
        const msg = document.createElement("ui5-label");
        msg.className = "netz-dataroom-empty-msg";
        msg.textContent = "This folder is empty";
        empty.appendChild(msg);
        const hint = document.createElement("ui5-label");
        hint.className = "netz-dataroom-empty-hint";
        hint.textContent = "Upload documents to the blob storage to populate the data room";
        empty.appendChild(hint);
        this.tableWrap.appendChild(empty);
        return;
      }

      const table = document.createElement("ui5-table");
      table.className = "netz-dataroom-table";

      /* Header cells */
      const headers = [
        { label: "", width: "3rem" },
        { label: "Name" },
        { label: "Type", width: "120px" },
        { label: "Size", width: "100px" },
        { label: "Last Modified", width: "180px" },
      ];
      headers.forEach((col) => {
        const hc = document.createElement("ui5-table-header-cell");
        hc.textContent = col.label;
        if (col.width) hc.width = col.width;
        table.appendChild(hc);
      });

      /* Rows */
      items.forEach((entry) => {
        const row = document.createElement("ui5-table-row");

        if (entry.is_folder) {
          row.style.cursor = "pointer";
          row.addEventListener("click", () => this._openFolder(entry.name));
        }

        /* Icon cell */
        const iconCell = document.createElement("ui5-table-cell");
        const icon = document.createElement("ui5-icon");
        icon.name = iconForEntry(entry);
        if (entry.is_folder) {
          icon.style.color = "var(--sapInformativeColor)";
        }
        iconCell.appendChild(icon);
        row.appendChild(iconCell);

        /* Name cell */
        const nameCell = document.createElement("ui5-table-cell");
        const nameText = document.createElement("span");
        nameText.textContent = displayName(entry.name, entry.is_folder);
        if (entry.is_folder) {
          nameText.style.fontWeight = "600";
          nameText.style.color = "var(--sapLinkColor)";
        }
        nameCell.appendChild(nameText);
        row.appendChild(nameCell);

        /* Type cell */
        const typeCell = document.createElement("ui5-table-cell");
        if (entry.is_folder) {
          typeCell.textContent = "Folder";
        } else {
          typeCell.textContent = entry.content_type || fileExtension(entry.name);
        }
        row.appendChild(typeCell);

        /* Size cell */
        const sizeCell = document.createElement("ui5-table-cell");
        sizeCell.textContent = entry.is_folder ? "\u2014" : fmtSize(entry.size_bytes);
        row.appendChild(sizeCell);

        /* Last Modified cell */
        const dateCell = document.createElement("ui5-table-cell");
        dateCell.textContent = entry.is_folder ? "\u2014" : fmtDate(entry.last_modified);
        row.appendChild(dateCell);

        table.appendChild(row);
      });

      this.tableWrap.appendChild(table);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load data room");
    } finally {
      this.busy.active = false;
    }
  }
}

/* ── Small utility ── */

function fileExtension(name) {
  if (!name) return "\u2014";
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "File";
  return name.substring(dot + 1).toUpperCase();
}
