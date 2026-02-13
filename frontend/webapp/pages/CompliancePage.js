import * as complianceApi from "../api/compliance.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function firstItemId(page) {
  const items = page?.items;
  if (Array.isArray(items) && items.length > 0 && items[0]?.id) {
    return String(items[0].id);
  }
  return "";
}

export class CompliancePage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.selectedObligationId = "";

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Compliance";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Wave 2 placeholder: snapshot, obligations, detail, evidence, workflow and audit trail.";
    header.appendChild(strip);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = false;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";

    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";
    content.appendChild(this.error);

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexWrap = "wrap";
    controls.style.gap = "0.5rem";
    controls.style.marginBottom = "0.75rem";

    this.obligationIdInput = document.createElement("ui5-input");
    this.obligationIdInput.placeholder = "Obligation ID";
    this.obligationIdInput.style.minWidth = "24rem";

    this.refreshButton = document.createElement("ui5-button");
    this.refreshButton.design = "Emphasized";
    this.refreshButton.textContent = "Refresh Compliance";
    this.refreshButton.addEventListener("click", () => this.onShow());

    this.loadDetailButton = document.createElement("ui5-button");
    this.loadDetailButton.textContent = "Open Obligation Detail";
    this.loadDetailButton.addEventListener("click", () => this.loadObligationDetail());

    this.markInProgressButton = document.createElement("ui5-button");
    this.markInProgressButton.textContent = "Mark In Progress";
    this.markInProgressButton.addEventListener("click", () => this.markObligationInProgress());

    this.closeButton = document.createElement("ui5-button");
    this.closeButton.textContent = "Close Obligation";
    this.closeButton.addEventListener("click", () => this.closeObligation());

    this.recomputeStatusButton = document.createElement("ui5-button");
    this.recomputeStatusButton.textContent = "Recompute Status";
    this.recomputeStatusButton.addEventListener("click", () => this.recomputeStatus());

    this.recomputeGapsButton = document.createElement("ui5-button");
    this.recomputeGapsButton.textContent = "Recompute Gaps";
    this.recomputeGapsButton.addEventListener("click", () => this.recomputeGaps());

    controls.append(
      this.obligationIdInput,
      this.refreshButton,
      this.loadDetailButton,
      this.markInProgressButton,
      this.closeButton,
      this.recomputeStatusButton,
      this.recomputeGapsButton,
    );
    content.appendChild(controls);

    this.snapshotPre = document.createElement("pre");
    this.snapshotPre.style.padding = "0.75rem";
    this.snapshotPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.obligationsPre = document.createElement("pre");
    this.obligationsPre.style.padding = "0.75rem";
    this.obligationsPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.detailPre = document.createElement("pre");
    this.detailPre.style.padding = "0.75rem";
    this.detailPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.auditPre = document.createElement("pre");
    this.auditPre.style.padding = "0.75rem";
    this.auditPre.style.border = "1px solid var(--sapList_BorderColor)";

    content.append(this.snapshotPre, this.obligationsPre, this.detailPre, this.auditPre);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _effectiveObligationId() {
    return String(this.obligationIdInput.value || this.selectedObligationId || "").trim();
  }

  _setError(message) {
    this.error.textContent = message;
    this.error.style.display = "block";
  }

  _clearError() {
    this.error.style.display = "none";
    this.error.textContent = "";
  }

  async onShow() {
    this.busy.active = true;
    this._clearError();

    if (!this.fundId) {
      this._setError("No fund scope. Provide ?fundId= in the URL.");
      this.busy.active = false;
      return;
    }

    try {
      const [snapshot, obligations, gaps] = await Promise.all([
        complianceApi.getComplianceSnapshot(this.fundId),
        complianceApi.listComplianceObligations(this.fundId, { limit: 10, offset: 0, view: "all" }),
        complianceApi.listComplianceGaps(this.fundId, { limit: 10, offset: 0 }),
      ]);

      this.selectedObligationId = firstItemId(obligations);
      if (!this.obligationIdInput.value && this.selectedObligationId) {
        this.obligationIdInput.value = this.selectedObligationId;
      }

      this.snapshotPre.textContent = pretty({ snapshot, gaps });
      this.obligationsPre.textContent = pretty(obligations);

      if (this._effectiveObligationId()) {
        await this.loadObligationDetail();
      } else {
        this.detailPre.textContent = pretty({ message: "No obligation available." });
        this.auditPre.textContent = pretty([]);
      }
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load compliance data");
    } finally {
      this.busy.active = false;
    }
  }

  async loadObligationDetail() {
    const obligationId = this._effectiveObligationId();
    if (!obligationId) {
      this._setError("Provide an obligation id to load detail.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      const [detail, evidence, audit] = await Promise.all([
        complianceApi.getComplianceObligation(this.fundId, obligationId),
        complianceApi.listComplianceObligationEvidence(this.fundId, obligationId),
        complianceApi.listComplianceObligationAudit(this.fundId, obligationId),
      ]);
      this.detailPre.textContent = pretty({ detail, evidence });
      this.auditPre.textContent = pretty(audit);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load obligation detail");
    } finally {
      this.busy.active = false;
    }
  }

  async markObligationInProgress() {
    const obligationId = this._effectiveObligationId();
    if (!obligationId) {
      this._setError("Provide an obligation id to mark in progress.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      await complianceApi.markComplianceObligationInProgress(this.fundId, obligationId);
      await this.loadObligationDetail();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to mark obligation in progress");
    } finally {
      this.busy.active = false;
    }
  }

  async closeObligation() {
    const obligationId = this._effectiveObligationId();
    if (!obligationId) {
      this._setError("Provide an obligation id to close.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      await complianceApi.closeComplianceObligation(this.fundId, obligationId);
      await this.loadObligationDetail();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to close obligation");
    } finally {
      this.busy.active = false;
    }
  }

  async recomputeStatus() {
    this.busy.active = true;
    this._clearError();
    try {
      const statusPage = await complianceApi.recomputeComplianceObligationStatus(this.fundId);
      this.snapshotPre.textContent = pretty({
        snapshot: await complianceApi.getComplianceSnapshot(this.fundId),
        recomputed_status: statusPage,
      });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to recompute obligation status");
    } finally {
      this.busy.active = false;
    }
  }

  async recomputeGaps() {
    this.busy.active = true;
    this._clearError();
    try {
      const recomputed = await complianceApi.recomputeComplianceGaps(this.fundId);
      this.snapshotPre.textContent = pretty({
        snapshot: await complianceApi.getComplianceSnapshot(this.fundId),
        recomputed_gaps: recomputed,
      });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to recompute gaps");
    } finally {
      this.busy.active = false;
    }
  }
}
