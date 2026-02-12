import * as reportingApi from "../api/reporting.js";
import * as documentsApi from "../api/documents.js";
import * as copilotApi from "../api/copilot.js";

function card(title, value, subtitle) {
  const c = document.createElement("ui5-card");
  c.heading = title;

  const content = document.createElement("div");
  content.style.padding = "1rem";
  const v = document.createElement("ui5-title");
  v.level = "H2";
  v.textContent = value;
  content.appendChild(v);
  if (subtitle) {
    const s = document.createElement("div");
    s.style.marginTop = "0.25rem";
    s.textContent = subtitle;
    content.appendChild(s);
  }
  c.appendChild(content);
  return c;
}

export class DashboardPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const t = document.createElement("ui5-title");
    t.level = "H1";
    t.textContent = "Dashboard";
    title.appendChild(t);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = this.fundId ? `Fund scope: ${this.fundId}` : "No fund scope set. Provide ?fundId= in the URL.";
    header.appendChild(strip);
    this.el.appendChild(header);

    this._grid = document.createElement("ui5-flex-box");
    this._grid.wrap = "Wrap";
    this._grid.style.gap = "1rem";
    this._grid.style.padding = "1rem";
    this._grid.style.alignItems = "Stretch";

    this._busy = document.createElement("ui5-busy-indicator");
    this._busy.active = true;
    this._busy.size = "Large";
    this._busy.style.width = "100%";
    this._busy.appendChild(this._grid);
    this.el.appendChild(this._busy);
  }

  async onShow() {
    this._grid.replaceChildren(
      card("Documents in Data Room", "—"),
      card("Pending Transfers", "—"),
      card("Pending Obligations", "—"),
      card("Latest AI Evidence Queries", "—")
    );

    if (!this.fundId) {
      this._busy.active = false;
      return;
    }

    try {
      const [docsPage, cashSnap, compSnap, aiActivity] = await Promise.all([
        documentsApi.listDocuments(this.fundId, { limit: 1, offset: 0 }),
        reportingApi.getCashSnapshot(this.fundId),
        reportingApi.getComplianceSnapshot(this.fundId),
        copilotApi.getAIActivity(this.fundId, { limit: 5, offset: 0 }),
      ]);

      const docsCount = docsPage?.total ?? docsPage?.items?.length ?? "—";
      const pendingTransfers = cashSnap?.pending_signatures ?? "—";
      const pendingObligations = compSnap?.total_open_obligations ?? "—";
      const latestAi = aiActivity?.items?.length ?? aiActivity?.count ?? "—";

      this._grid.replaceChildren(
        card("Documents in Data Room", String(docsCount), "Governed registry"),
        card("Pending Transfers", String(pendingTransfers), "Awaiting signatures / processing"),
        card("Pending Obligations", String(pendingObligations), "Evidence gaps & workflow"),
        card("Latest AI Evidence Queries", String(latestAi), "Citations required"),
      );
    } catch (e) {
      this._grid.replaceChildren(card("Dashboard", "Failed to load", e?.message ? String(e.message) : "Error"));
    } finally {
      this._busy.active = false;
    }
  }
}
