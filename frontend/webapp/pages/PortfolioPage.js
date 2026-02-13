import * as portfolioApi from "../api/portfolio.js";

function toPrettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class PortfolioPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Portfolio";
    title.appendChild(heading);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Placeholder Wave 1: borrowers/loans/covenants/breaches/alerts via backend real endpoints.";
    header.appendChild(strip);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = true;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";

    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";

    this.refreshButton = document.createElement("ui5-button");
    this.refreshButton.design = "Emphasized";
    this.refreshButton.textContent = "Refresh Portfolio";
    this.refreshButton.addEventListener("click", () => this.onShow());

    this.output = document.createElement("pre");
    this.output.style.margin = "1rem 0 0 0";
    this.output.style.padding = "1rem";
    this.output.style.background = "var(--sapList_Background)";
    this.output.style.border = "1px solid var(--sapList_BorderColor)";
    this.output.style.whiteSpace = "pre-wrap";

    content.append(this.error, this.refreshButton, this.output);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  async onShow() {
    this.busy.active = true;
    this.error.style.display = "none";

    if (!this.fundId) {
      this.error.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this.error.style.display = "block";
      this.output.textContent = "{}";
      this.busy.active = false;
      return;
    }

    try {
      const [borrowers, loans, covenants, breaches, alerts] = await Promise.all([
        portfolioApi.listBorrowers(this.fundId, { limit: 10, offset: 0 }),
        portfolioApi.listLoans(this.fundId, { limit: 10, offset: 0 }),
        portfolioApi.listCovenants(this.fundId, { limit: 10, offset: 0 }),
        portfolioApi.listBreaches(this.fundId, { limit: 10, offset: 0 }),
        portfolioApi.listAlerts(this.fundId, { limit: 10, offset: 0 }),
      ]);

      const payload = {
        borrowers,
        loans,
        covenants,
        breaches,
        alerts,
      };

      this.output.textContent = toPrettyJson(payload);
    } catch (error) {
      this.error.textContent = error?.message ? String(error.message) : "Failed to load portfolio endpoints";
      this.error.style.display = "block";
      this.output.textContent = "{}";
    } finally {
      this.busy.active = false;
    }
  }
}
