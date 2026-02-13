import * as alertsDomainApi from "../api/alertsDomain.js";
import * as portfolioApi from "../api/portfolio.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class AlertsPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Alerts";
    title.appendChild(h);
    this.el.appendChild(title);

    const content = document.createElement("div");
    content.className = "netz-page-content";
    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";

    const load = document.createElement("ui5-button");
    load.design = "Emphasized";
    load.textContent = "Load Alerts";
    load.addEventListener("click", () => this.onShow());

    content.append(load, this.out);
    this.el.appendChild(content);
  }

  async onShow() {
    const [domainAlerts, portfolioAlerts] = await Promise.all([
      alertsDomainApi.listDomainAlerts(this.fundId),
      portfolioApi.listAlerts(this.fundId, { limit: 20, offset: 0 }),
    ]);
    this.out.textContent = pretty({ domainAlerts, portfolioAlerts });
  }
}
