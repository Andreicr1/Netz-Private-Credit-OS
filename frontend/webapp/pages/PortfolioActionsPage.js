import * as portfolioActionsApi from "../api/portfolioActions.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function firstId(payload) {
  if (Array.isArray(payload) && payload[0]?.id) return String(payload[0].id);
  if (Array.isArray(payload?.items) && payload.items[0]?.id) return String(payload.items[0].id);
  return "";
}

export class PortfolioActionsPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");
    this.actionId = document.createElement("ui5-input");
    this.actionId.placeholder = "Action ID";
    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";

    const wrap = document.createElement("div");
    wrap.className = "netz-page-content";
    const load = document.createElement("ui5-button");
    load.design = "Emphasized";
    load.textContent = "Load Actions";
    load.addEventListener("click", () => this.onShow());
    const update = document.createElement("ui5-button");
    update.design = "Transparent";
    update.textContent = "Update Action";
    update.addEventListener("click", () => this.updateAction());
    wrap.append(this.actionId, load, update, this.out);
    this.el.appendChild(wrap);
  }

  async onShow() {
    const list = await portfolioActionsApi.listPortfolioActions(this.fundId);
    if (!this.actionId.value) this.actionId.value = firstId(list);
    this.out.textContent = pretty(list);
  }

  async updateAction() {
    const id = String(this.actionId.value || "").trim();
    if (!id) return;
    const updated = await portfolioActionsApi.updatePortfolioAction(this.fundId, id, { status: "CLOSED" });
    const list = await portfolioActionsApi.listPortfolioActions(this.fundId);
    this.out.textContent = pretty({ updated, list });
  }
}
