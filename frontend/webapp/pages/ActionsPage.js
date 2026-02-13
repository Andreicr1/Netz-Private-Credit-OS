import * as actionsApi from "../api/actions.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function firstActionId(pageOrList) {
  if (Array.isArray(pageOrList) && pageOrList[0]?.id) {
    return String(pageOrList[0].id);
  }
  const items = pageOrList?.items;
  if (Array.isArray(items) && items[0]?.id) {
    return String(items[0].id);
  }
  return "";
}

export class ActionsPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.selectedActionId = "";

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Actions";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Wave 2 placeholder: execution actions + governed actions with explicit status/evidence operations.";
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

    this.actionIdInput = document.createElement("ui5-input");
    this.actionIdInput.placeholder = "Action ID";
    this.actionIdInput.style.minWidth = "22rem";

    this.statusInput = document.createElement("ui5-input");
    this.statusInput.placeholder = "Status (e.g. CLOSED)";
    this.statusInput.value = "CLOSED";

    this.refreshButton = document.createElement("ui5-button");
    this.refreshButton.design = "Emphasized";
    this.refreshButton.textContent = "Refresh Actions";
    this.refreshButton.addEventListener("click", () => this.onShow());

    this.createExecutionButton = document.createElement("ui5-button");
    this.createExecutionButton.textContent = "Create Execution Action";
    this.createExecutionButton.addEventListener("click", () => this.createExecutionAction());

    this.updateExecutionStatusButton = document.createElement("ui5-button");
    this.updateExecutionStatusButton.textContent = "Update Execution Status";
    this.updateExecutionStatusButton.addEventListener("click", () => this.updateExecutionStatus());

    this.attachEvidenceButton = document.createElement("ui5-button");
    this.attachEvidenceButton.textContent = "Attach Execution Evidence";
    this.attachEvidenceButton.addEventListener("click", () => this.attachExecutionEvidence());

    this.createGovernedButton = document.createElement("ui5-button");
    this.createGovernedButton.textContent = "Create Governed Action";
    this.createGovernedButton.addEventListener("click", () => this.createGovernedAction());

    this.updateGovernedButton = document.createElement("ui5-button");
    this.updateGovernedButton.textContent = "Update Governed Status";
    this.updateGovernedButton.addEventListener("click", () => this.updateGovernedStatus());

    controls.append(
      this.actionIdInput,
      this.statusInput,
      this.refreshButton,
      this.createExecutionButton,
      this.updateExecutionStatusButton,
      this.attachEvidenceButton,
      this.createGovernedButton,
      this.updateGovernedButton,
    );

    this.executionPre = document.createElement("pre");
    this.executionPre.style.padding = "0.75rem";
    this.executionPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.governedPre = document.createElement("pre");
    this.governedPre.style.padding = "0.75rem";
    this.governedPre.style.border = "1px solid var(--sapList_BorderColor)";

    content.append(controls, this.executionPre, this.governedPre);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _effectiveActionId() {
    return String(this.actionIdInput.value || this.selectedActionId || "").trim();
  }

  _clearError() {
    this.error.style.display = "none";
    this.error.textContent = "";
  }

  _setError(message) {
    this.error.textContent = message;
    this.error.style.display = "block";
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
      const [executionPage, governedList] = await Promise.all([
        actionsApi.listExecutionActions(this.fundId, { limit: 10, offset: 0 }),
        actionsApi.listGovernedActions(this.fundId),
      ]);

      this.selectedActionId = this._effectiveActionId() || firstActionId(executionPage) || firstActionId(governedList);
      if (!this.actionIdInput.value && this.selectedActionId) {
        this.actionIdInput.value = this.selectedActionId;
      }

      this.executionPre.textContent = pretty(executionPage);
      this.governedPre.textContent = pretty(governedList);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load actions");
    } finally {
      this.busy.active = false;
    }
  }

  async createExecutionAction() {
    this.busy.active = true;
    this._clearError();
    try {
      await actionsApi.createExecutionAction(this.fundId, {
        title: `Execution Action ${new Date().toISOString()}`,
        description: "Placeholder Wave 2",
        status: "Open",
      });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to create execution action");
    } finally {
      this.busy.active = false;
    }
  }

  async updateExecutionStatus() {
    const actionId = this._effectiveActionId();
    if (!actionId) {
      this._setError("Provide an action id to update execution status.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      await actionsApi.updateExecutionActionStatus(this.fundId, actionId, { status: String(this.statusInput.value || "CLOSED") });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to update execution action status");
    } finally {
      this.busy.active = false;
    }
  }

  async attachExecutionEvidence() {
    const actionId = this._effectiveActionId();
    if (!actionId) {
      this._setError("Provide an action id to attach evidence.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      await actionsApi.attachExecutionActionEvidence(this.fundId, actionId, {
        filename: `evidence-${Date.now()}.json`,
        status: "pending_review",
        document_ref: "wave2-placeholder",
      });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to attach evidence");
    } finally {
      this.busy.active = false;
    }
  }

  async createGovernedAction() {
    this.busy.active = true;
    this._clearError();
    try {
      await actionsApi.createGovernedAction(this.fundId, {
        title: `Governed Action ${new Date().toISOString()}`,
      });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to create governed action");
    } finally {
      this.busy.active = false;
    }
  }

  async updateGovernedStatus() {
    const actionId = this._effectiveActionId();
    if (!actionId) {
      this._setError("Provide an action id to update governed action status.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      await actionsApi.updateGovernedActionStatus(this.fundId, actionId, {
        status: String(this.statusInput.value || "CLOSED"),
        evidence_notes: "Wave 2 placeholder update",
      });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to update governed action status");
    } finally {
      this.busy.active = false;
    }
  }
}
