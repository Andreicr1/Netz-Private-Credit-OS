import * as reportPacksLegacyApi from "../api/reportPacksLegacy.js";
import * as reportingApi from "../api/reporting.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class ReportPacksLegacyPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const wrap = document.createElement("div");
    wrap.className = "netz-page-content";

    this.packId = document.createElement("ui5-input");
    this.packId.placeholder = "Pack ID";

    const create = document.createElement("ui5-button");
    create.textContent = "Create Legacy Report Pack";
    create.addEventListener("click", () => this.createPack());

    const generate = document.createElement("ui5-button");
    generate.textContent = "Generate Legacy Pack";
    generate.addEventListener("click", () => this.generatePack());

    const publish = document.createElement("ui5-button");
    publish.textContent = "Publish Legacy Pack";
    publish.addEventListener("click", () => this.publishPack());

    const refresh = document.createElement("ui5-button");
    refresh.design = "Emphasized";
    refresh.textContent = "List Monthly Packs";
    refresh.addEventListener("click", () => this.onShow());

    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";

    wrap.append(this.packId, create, generate, publish, refresh, this.out);
    this.el.appendChild(wrap);
  }

  async onShow() {
    const monthlyPacks = await reportingApi.listMonthlyPacks(this.fundId);
    this.out.textContent = pretty(monthlyPacks);
  }

  async createPack() {
    const created = await reportPacksLegacyApi.createReportPack(this.fundId, { title: `Legacy Pack ${Date.now()}` });
    const monthlyPacks = await reportingApi.listMonthlyPacks(this.fundId);
    this.out.textContent = pretty({ created, monthlyPacks });
  }

  async generatePack() {
    const packId = String(this.packId.value || "").trim();
    if (!packId) return;
    const generated = await reportPacksLegacyApi.generateReportPack(this.fundId, packId);
    const monthlyPacks = await reportingApi.listMonthlyPacks(this.fundId);
    this.out.textContent = pretty({ generated, monthlyPacks });
  }

  async publishPack() {
    const packId = String(this.packId.value || "").trim();
    if (!packId) return;
    const published = await reportPacksLegacyApi.publishReportPack(this.fundId, packId);
    const monthlyPacks = await reportingApi.listMonthlyPacks(this.fundId);
    this.out.textContent = pretty({ published, monthlyPacks });
  }
}
