import * as assetObligationsApi from "../api/assetObligations.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function firstId(payload) {
  if (Array.isArray(payload?.items) && payload.items[0]?.id) return String(payload.items[0].id);
  if (Array.isArray(payload) && payload[0]?.id) return String(payload[0].id);
  return "";
}

export class AssetObligationsPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const wrap = document.createElement("div");
    wrap.className = "netz-page-content";

    this.assetId = document.createElement("ui5-input");
    this.assetId.placeholder = "Asset ID";
    this.obligationId = document.createElement("ui5-input");
    this.obligationId.placeholder = "Obligation ID";

    const load = document.createElement("ui5-button");
    load.design = "Emphasized";
    load.textContent = "List Obligations";
    load.addEventListener("click", () => this.onShow());

    const create = document.createElement("ui5-button");
    create.textContent = "Create Asset Obligation";
    create.addEventListener("click", () => this.create());

    const update = document.createElement("ui5-button");
    update.textContent = "Update Obligation";
    update.addEventListener("click", () => this.update());

    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";

    wrap.append(this.assetId, this.obligationId, load, create, update, this.out);
    this.el.appendChild(wrap);
  }

  async onShow() {
    const list = await assetObligationsApi.listAssetObligations(this.fundId);
    if (!this.obligationId.value) this.obligationId.value = firstId(list);
    this.out.textContent = pretty(list);
  }

  async create() {
    const assetId = String(this.assetId.value || "").trim();
    if (!assetId) return;
    const created = await assetObligationsApi.createAssetObligation(this.fundId, assetId, { title: "Obligation" });
    const list = await assetObligationsApi.listAssetObligations(this.fundId);
    this.out.textContent = pretty({ created, list });
  }

  async update() {
    const obligationId = String(this.obligationId.value || "").trim();
    if (!obligationId) return;
    const updated = await assetObligationsApi.updateObligation(this.fundId, obligationId, { status: "COMPLETED" });
    const list = await assetObligationsApi.listAssetObligations(this.fundId);
    this.out.textContent = pretty({ updated, list });
  }
}
