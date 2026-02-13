import * as investorPortalApi from "../api/investorPortal.js";
import * as reportingApi from "../api/reporting.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class InvestorPortalPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const wrap = document.createElement("div");
    wrap.className = "netz-page-content";
    const load = document.createElement("ui5-button");
    load.design = "Emphasized";
    load.textContent = "Load Investor Portal";
    load.addEventListener("click", () => this.onShow());

    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";
    wrap.append(load, this.out);
    this.el.appendChild(wrap);
  }

  async onShow() {
    const [investorPacks, archive] = await Promise.all([
      investorPortalApi.listInvestorReportPacks(this.fundId),
      reportingApi.getReportingArchive(this.fundId),
    ]);
    this.out.textContent = pretty({ investorPacks, archive });
  }
}
