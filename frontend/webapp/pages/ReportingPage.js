import * as reportingApi from "../api/reporting.js";
import * as reportPacksLegacyApi from "../api/reportPacksLegacy.js";
import * as investorPortalApi from "../api/investorPortal.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function firstSnapshotId(payload) {
  if (Array.isArray(payload?.items) && payload.items[0]?.id) return String(payload.items[0].id);
  if (Array.isArray(payload) && payload[0]?.id) return String(payload[0].id);
  return "";
}

/**
 * ReportingPage — tab container for reporting sub-domains.
 *
 * Tabs: NAV Snapshots | Monthly Packs | Report Packs (Legacy) | Investor Statements
 */
export class ReportingPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this._activeTab = "nav-snapshots";

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Reporting";
    pageTitle.appendChild(h);
    this.el.appendChild(pageTitle);

    // Tab container
    this.tabContainer = document.createElement("ui5-tabcontainer");
    this.tabContainer.className = "netz-reporting-tabs";
    this.tabContainer.addEventListener("tab-select", (e) => {
      const key = e.detail?.tab?.dataset?.key;
      if (key) {
        this._activeTab = key;
        this._loadTabData(key);
      }
    });

    const tabDefs = [
      { key: "nav-snapshots", text: "NAV Snapshots", icon: "table-chart" },
      { key: "monthly-packs", text: "Monthly Packs", icon: "calendar" },
      { key: "report-packs", text: "Report Packs (Legacy)", icon: "business-card" },
      { key: "investor-statements", text: "Investor Statements", icon: "customer" },
    ];

    this._tabPanels = {};
    tabDefs.forEach((def, idx) => {
      const tab = document.createElement("ui5-tab");
      tab.text = def.text;
      tab.icon = def.icon;
      tab.dataset.key = def.key;
      if (idx === 0) tab.selected = true;

      const panel = document.createElement("div");
      panel.className = "netz-tab-panel";

      // NAV Snapshots: add snapshot ID input
      if (def.key === "nav-snapshots") {
        const controls = document.createElement("div");
        controls.style.display = "flex";
        controls.style.flexWrap = "wrap";
        controls.style.gap = "0.5rem";
        controls.style.marginBottom = "0.75rem";

        this.snapshotIdInput = document.createElement("ui5-input");
        this.snapshotIdInput.placeholder = "NAV Snapshot ID";
        this.snapshotIdInput.style.minWidth = "24rem";

        const loadAssets = document.createElement("ui5-button");
        loadAssets.textContent = "Load Snapshot Assets";
        loadAssets.addEventListener("click", () => this.loadSnapshotAssets());

        const exportBtn = document.createElement("ui5-button");
        exportBtn.textContent = "Export Evidence Pack";
        exportBtn.addEventListener("click", () => this.exportEvidence());

        controls.append(this.snapshotIdInput, loadAssets, exportBtn);
        panel.appendChild(controls);
      }

      // Report Packs: add pack controls
      if (def.key === "report-packs") {
        const controls = document.createElement("div");
        controls.style.display = "flex";
        controls.style.flexWrap = "wrap";
        controls.style.gap = "0.5rem";
        controls.style.marginBottom = "0.75rem";

        this.packIdInput = document.createElement("ui5-input");
        this.packIdInput.placeholder = "Pack ID";

        const createPack = document.createElement("ui5-button");
        createPack.textContent = "Create Legacy Pack";
        createPack.addEventListener("click", () => this.createLegacyPack());

        const generate = document.createElement("ui5-button");
        generate.textContent = "Generate Pack";
        generate.addEventListener("click", () => this.generateLegacyPack());

        const publish = document.createElement("ui5-button");
        publish.textContent = "Publish Pack";
        publish.addEventListener("click", () => this.publishLegacyPack());

        controls.append(this.packIdInput, createPack, generate, publish);
        panel.appendChild(controls);
      }

      const output = document.createElement("pre");
      output.className = "netz-tab-output";
      output.style.padding = "0.75rem";
      output.style.border = "1px solid var(--sapList_BorderColor)";
      output.style.whiteSpace = "pre-wrap";
      panel.appendChild(output);
      tab.appendChild(panel);

      this._tabPanels[def.key] = { tab, output };
      this.tabContainer.appendChild(tab);
    });

    // Error strip
    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";

    // Busy indicator
    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = false;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";
    content.append(this.error, this.tabContainer);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _setError(msg) {
    this.error.textContent = msg;
    this.error.style.display = "block";
  }

  _clearError() {
    this.error.style.display = "none";
    this.error.textContent = "";
  }

  async onShow() {
    this._clearError();
    if (!this.fundId) {
      this._setError("No fund scope. Provide ?fundId= in the URL.");
      return;
    }
    await this._loadTabData(this._activeTab);
  }

  async _loadTabData(key) {
    this.busy.active = true;
    this._clearError();
    const out = this._tabPanels[key]?.output;
    try {
      let data;
      switch (key) {
        case "nav-snapshots": {
          const snapshots = await reportingApi.listNavSnapshots(this.fundId, { limit: 20, offset: 0 });
          const snapshotId = String(this.snapshotIdInput?.value || firstSnapshotId(snapshots) || "").trim();
          if (this.snapshotIdInput && !this.snapshotIdInput.value && snapshotId) {
            this.snapshotIdInput.value = snapshotId;
          }
          if (snapshotId) {
            const assets = await reportingApi.listNavSnapshotAssets(this.fundId, snapshotId);
            data = { snapshots, assets };
          } else {
            data = { snapshots, assets: [] };
          }
          break;
        }
        case "monthly-packs":
          data = await reportingApi.listMonthlyPacks(this.fundId);
          break;
        case "report-packs":
          data = await reportingApi.listMonthlyPacks(this.fundId);
          break;
        case "investor-statements": {
          const [investorPacks, archive] = await Promise.all([
            investorPortalApi.listInvestorReportPacks(this.fundId),
            reportingApi.getReportingArchive(this.fundId),
          ]);
          data = { investorPacks, archive };
          break;
        }
        default:
          data = {};
      }
      if (out) out.textContent = pretty(data);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : `Failed to load ${key}`);
      if (out) out.textContent = "{}";
    } finally {
      this.busy.active = false;
    }
  }

  async loadSnapshotAssets() {
    const snapshotId = String(this.snapshotIdInput?.value || "").trim();
    if (!snapshotId) {
      this._setError("Provide a NAV Snapshot ID.");
      return;
    }
    this.busy.active = true;
    this._clearError();
    try {
      const assets = await reportingApi.listNavSnapshotAssets(this.fundId, snapshotId);
      const out = this._tabPanels["nav-snapshots"]?.output;
      if (out) out.textContent = pretty({ snapshotId, assets });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load snapshot assets");
    } finally {
      this.busy.active = false;
    }
  }

  async exportEvidence() {
    this.busy.active = true;
    this._clearError();
    try {
      const result = await reportingApi.exportEvidencePack(this.fundId, { limit: 50 });
      const out = this._tabPanels["nav-snapshots"]?.output;
      if (out) out.textContent = pretty({ evidenceExport: result });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to export evidence pack");
    } finally {
      this.busy.active = false;
    }
  }

  async createLegacyPack() {
    this.busy.active = true;
    this._clearError();
    try {
      const created = await reportPacksLegacyApi.createReportPack(this.fundId, { title: `Legacy Pack ${Date.now()}` });
      const out = this._tabPanels["report-packs"]?.output;
      if (out) out.textContent = pretty({ created });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to create legacy pack");
    } finally {
      this.busy.active = false;
    }
  }

  async generateLegacyPack() {
    const packId = String(this.packIdInput?.value || "").trim();
    if (!packId) { this._setError("Provide a Pack ID."); return; }
    this.busy.active = true;
    this._clearError();
    try {
      const generated = await reportPacksLegacyApi.generateReportPack(this.fundId, packId);
      const out = this._tabPanels["report-packs"]?.output;
      if (out) out.textContent = pretty({ generated });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to generate legacy pack");
    } finally {
      this.busy.active = false;
    }
  }

  async publishLegacyPack() {
    const packId = String(this.packIdInput?.value || "").trim();
    if (!packId) { this._setError("Provide a Pack ID."); return; }
    this.busy.active = true;
    this._clearError();
    try {
      const published = await reportPacksLegacyApi.publishReportPack(this.fundId, packId);
      const out = this._tabPanels["report-packs"]?.output;
      if (out) out.textContent = pretty({ published });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to publish legacy pack");
    } finally {
      this.busy.active = false;
    }
  }
}
