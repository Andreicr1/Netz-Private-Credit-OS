import * as reportingApi from "../api/reporting.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class ReportingPage {
  constructor({ fundId }) {
    this.fundId = fundId;

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Reporting";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Wave 4 placeholder: NAV snapshots, monthly packs, archive and evidence export endpoints.";
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

    this.refreshButton = document.createElement("ui5-button");
    this.refreshButton.design = "Emphasized";
    this.refreshButton.textContent = "Refresh Reporting";
    this.refreshButton.addEventListener("click", () => this.onShow());

    this.exportEvidenceButton = document.createElement("ui5-button");
    this.exportEvidenceButton.textContent = "Export Evidence Pack";
    this.exportEvidenceButton.addEventListener("click", () => this.exportEvidence());

    controls.append(this.refreshButton, this.exportEvidenceButton);

    this.snapshotsPre = document.createElement("pre");
    this.snapshotsPre.style.padding = "0.75rem";
    this.snapshotsPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.packsPre = document.createElement("pre");
    this.packsPre.style.padding = "0.75rem";
    this.packsPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.archivePre = document.createElement("pre");
    this.archivePre.style.padding = "0.75rem";
    this.archivePre.style.border = "1px solid var(--sapList_BorderColor)";

    content.append(controls, this.snapshotsPre, this.packsPre, this.archivePre);
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

  async onShow() {
    this.busy.active = true;
    this._clearError();

    if (!this.fundId) {
      this._setError("No fund scope. Provide ?fundId= in the URL.");
      this.busy.active = false;
      return;
    }

    try {
      const [snapshots, packs, archive] = await Promise.all([
        reportingApi.listNavSnapshots(this.fundId, { limit: 10, offset: 0 }),
        reportingApi.listMonthlyPacks(this.fundId),
        reportingApi.getReportingArchive(this.fundId),
      ]);

      this.snapshotsPre.textContent = pretty(snapshots);
      this.packsPre.textContent = pretty(packs);
      this.archivePre.textContent = pretty(archive);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load reporting data");
    } finally {
      this.busy.active = false;
    }
  }

  async exportEvidence() {
    this.busy.active = true;
    this._clearError();
    try {
      const result = await reportingApi.exportEvidencePack(this.fundId, { limit: 50 });
      this.archivePre.textContent = pretty(result);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to export evidence pack");
    } finally {
      this.busy.active = false;
    }
  }
}
