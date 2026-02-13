import * as reportingApi from "../api/reporting.js";

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

export class NavAssetsPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const wrap = document.createElement("div");
    wrap.className = "netz-page-content";

    this.snapshotId = document.createElement("ui5-input");
    this.snapshotId.placeholder = "NAV Snapshot ID";

    const load = document.createElement("ui5-button");
    load.design = "Emphasized";
    load.textContent = "Load Snapshot Assets";
    load.addEventListener("click", () => this.onShow());

    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";

    wrap.append(this.snapshotId, load, this.out);
    this.el.appendChild(wrap);
  }

  async onShow() {
    const snapshots = await reportingApi.listNavSnapshots(this.fundId, { limit: 10, offset: 0 });
    const snapshotId = String(this.snapshotId.value || firstSnapshotId(snapshots) || "").trim();
    if (!this.snapshotId.value && snapshotId) this.snapshotId.value = snapshotId;

    if (!snapshotId) {
      this.out.textContent = pretty({ snapshots, assets: [] });
      return;
    }

    const assets = await reportingApi.listNavSnapshotAssets(this.fundId, snapshotId);
    this.out.textContent = pretty({ snapshots, assets });
  }
}
