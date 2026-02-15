import * as assetsApi from "../api/assets.js";
import * as alertsDomainApi from "../api/alertsDomain.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class AssetsPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Assets";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Wave 6 placeholder: create asset and check domain alerts.";
    header.appendChild(strip);
    this.el.appendChild(header);

    const content = document.createElement("div");
    content.className = "netz-page-content";
    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";

    const refresh = document.createElement("ui5-button");
    refresh.design = "Emphasized";
    refresh.textContent = "Load Alerts";
    refresh.addEventListener("click", () => this.onShow());

    const create = document.createElement("ui5-button");
    create.design = "Transparent";
    create.textContent = "Create Asset";
    create.addEventListener("click", () => this.createAsset());

    content.append(refresh, create, this.out);
    this.el.appendChild(content);
  }

  async onShow() {
    const alerts = await alertsDomainApi.listDomainAlerts(this.fundId);
    this.out.textContent = pretty({ alerts });
  }

  async createAsset() {
    const created = await assetsApi.createAsset(this.fundId, { name: `Asset ${Date.now()}` });
    const alerts = await alertsDomainApi.listDomainAlerts(this.fundId);
    this.out.textContent = pretty({ created, alerts });
  }
}
