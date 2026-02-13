import * as fundInvestmentsApi from "../api/fundInvestments.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class FundInvestmentPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const wrap = document.createElement("div");
    wrap.className = "netz-page-content";

    this.assetId = document.createElement("ui5-input");
    this.assetId.placeholder = "Asset ID";

    const create = document.createElement("ui5-button");
    create.textContent = "Create Fund Investment";
    create.addEventListener("click", () => this.create());

    const get = document.createElement("ui5-button");
    get.design = "Emphasized";
    get.textContent = "Get Fund Investment";
    get.addEventListener("click", () => this.get());

    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";

    wrap.append(this.assetId, create, get, this.out);
    this.el.appendChild(wrap);
  }

  async create() {
    const id = String(this.assetId.value || "").trim();
    if (!id) return;
    const created = await fundInvestmentsApi.createFundInvestment(this.fundId, id, { amount: 1000 });
    this.out.textContent = pretty(created);
  }

  async get() {
    const id = String(this.assetId.value || "").trim();
    if (!id) return;
    const detail = await fundInvestmentsApi.getFundInvestment(this.fundId, id);
    this.out.textContent = pretty(detail);
  }
}
