import * as reportingApi from "../api/reporting.js";
import * as documentsApi from "../api/documents.js";
import * as copilotApi from "../api/copilot.js";

function makeCard(title, value, subtitle) {
  const c = document.createElement("ui5-card");
  c.heading = title;
  const box = document.createElement("div");
  box.style.padding = "1rem";
  const v = document.createElement("ui5-title");
  v.level = "H2";
  v.textContent = value;
  box.appendChild(v);
  if (subtitle) {
    const s = document.createElement("div");
    s.style.marginTop = "0.25rem";
    s.textContent = subtitle;
    box.appendChild(s);
  }
  c.appendChild(box);
  c.style.width = "18rem";
  return c;
}

export class DashboardPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Dashboard";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = this.fundId ? `Fund scope: ${this.fundId}` : "No fund scope set. Provide ?fundId= in the URL.";
    header.appendChild(strip);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = true;
    this.busy.style.width = "100%";

    this.grid = document.createElement("div");
    this.grid.className = "netz-page-content";
    this.grid.style.display = "grid";
    this.grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(18rem, 1fr))";
    this.grid.style.gap = "1rem";
    this.busy.appendChild(this.grid);
    this.el.appendChild(this.busy);
  }

  async onShow() {
    this.busy.active = true;
    this.grid.replaceChildren(
      makeCard("Documents in Data Room", "—"),
      makeCard("Pending Transfers", "—"),
      makeCard("Pending Obligations", "—"),
      makeCard("Latest AI Evidence Queries", "—")
    );

    if (!this.fundId) {
      this.busy.active = false;
      return;
    }

    try {
      const [docs, cashSnap, compSnap, aiAct] = await Promise.all([
        documentsApi.listDocuments(this.fundId, { limit: 1, offset: 0 }),
        reportingApi.getCashSnapshot(this.fundId),
        reportingApi.getComplianceSnapshot(this.fundId),
        copilotApi.getAIActivity(this.fundId, { limit: 5, offset: 0 })
      ]);

      const docsCount = docs?.total ?? (docs?.items?.length ?? "—");
      const pendingTransfers = cashSnap?.pending_signatures ?? "—";
      const pendingObligations = compSnap?.total_open_obligations ?? "—";
      const latestAi = aiAct?.items?.length ?? (aiAct?.count ?? "—");

      this.grid.replaceChildren(
        makeCard("Documents in Data Room", String(docsCount), "Governed registry"),
        makeCard("Pending Transfers", String(pendingTransfers), "Awaiting signatures"),
        makeCard("Pending Obligations", String(pendingObligations), "Evidence gaps"),
        makeCard("Latest AI Evidence Queries", String(latestAi), "Citations required")
      );
    } catch (e) {
      this.grid.replaceChildren(makeCard("Dashboard", "Failed to load", e?.message ? String(e.message) : "Error"));
    } finally {
      this.busy.active = false;
    }
  }
}
