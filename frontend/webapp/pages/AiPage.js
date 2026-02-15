import * as aiApi from "../api/ai.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class AiPage {
  constructor({ fundId }) {
    this.fundId = fundId;

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "AI";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Wave 4 placeholder: AI activity/history and evidence-based retrieval/answer endpoints.";
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

    this.questionInput = document.createElement("ui5-input");
    this.questionInput.placeholder = "Question";
    this.questionInput.value = "What are the latest key documents?";
    this.questionInput.style.minWidth = "28rem";

    this.refreshButton = document.createElement("ui5-button");
    this.refreshButton.design = "Emphasized";
    this.refreshButton.textContent = "Refresh AI Logs";
    this.refreshButton.addEventListener("click", () => this.onShow());

    this.askButton = document.createElement("ui5-button");
    this.askButton.design = "Transparent";
    this.askButton.textContent = "Retrieve + Answer";
    this.askButton.addEventListener("click", () => this.ask());

    controls.append(this.questionInput, this.refreshButton, this.askButton);

    this.activityPre = document.createElement("pre");
    this.activityPre.style.padding = "0.75rem";
    this.activityPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.historyPre = document.createElement("pre");
    this.historyPre.style.padding = "0.75rem";
    this.historyPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.answerPre = document.createElement("pre");
    this.answerPre.style.padding = "0.75rem";
    this.answerPre.style.border = "1px solid var(--sapList_BorderColor)";

    content.append(controls, this.activityPre, this.historyPre, this.answerPre);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
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
      const [activity, history] = await Promise.all([
        aiApi.listAIActivity(this.fundId, { limit: 10, offset: 0 }),
        aiApi.listAIHistory(this.fundId, { limit: 10, offset: 0 }),
      ]);

      this.activityPre.textContent = pretty(activity);
      this.historyPre.textContent = pretty(history);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load AI data");
    } finally {
      this.busy.active = false;
    }
  }

  async ask() {
    this.busy.active = true;
    this._clearError();
    try {
      const question = String(this.questionInput.value || "").trim();
      if (!question) {
        this._setError("Provide a question.");
        this.busy.active = false;
        return;
      }

      const [retrieved, answer] = await Promise.all([
        aiApi.retrieveAIContext(this.fundId, { query: question, top_k: 5 }),
        aiApi.answerAIQuestion(this.fundId, { question, require_citations: true }),
      ]);
      this.answerPre.textContent = pretty({ retrieved, answer });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to run AI retrieve/answer");
    } finally {
      this.busy.active = false;
    }
  }
}
