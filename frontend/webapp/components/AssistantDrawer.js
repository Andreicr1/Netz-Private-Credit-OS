/**
 * AssistantDrawer — Right-side AI assistant chat panel.
 * Opened from ShellBar icon. Static UI shell (no backend calls yet).
 */
export class AssistantDrawer {
  constructor({ onClose }) {
    this.el = document.createElement("div");
    this.el.className = "netz-assistant-drawer";
    this.el.setAttribute("role", "complementary");
    this.el.setAttribute("aria-label", "AI Assistant");

    // Header bar
    const header = document.createElement("div");
    header.className = "netz-assistant-drawer-header";

    const title = document.createElement("ui5-title");
    title.level = "H5";
    title.textContent = "Fund Assistant";
    header.appendChild(title);

    const closeBtn = document.createElement("ui5-button");
    closeBtn.icon = "decline";
    closeBtn.design = "Transparent";
    closeBtn.tooltip = "Close assistant";
    closeBtn.accessibleName = "Close assistant panel";
    closeBtn.addEventListener("click", () => {
      if (typeof onClose === "function") onClose();
    });
    header.appendChild(closeBtn);

    this.el.appendChild(header);

    // Chat history area
    const chatArea = document.createElement("div");
    chatArea.className = "netz-assistant-chat-area";

    const placeholder = document.createElement("ui5-message-strip");
    placeholder.design = "Information";
    placeholder.hideCloseButton = true;
    placeholder.textContent = "AI assistant coming soon. This panel will provide contextual help, document search, and fund insights.";
    chatArea.appendChild(placeholder);

    this.chatHistory = document.createElement("div");
    this.chatHistory.className = "netz-assistant-chat-history";
    chatArea.appendChild(this.chatHistory);

    this.el.appendChild(chatArea);

    // Input bar
    const inputBar = document.createElement("div");
    inputBar.className = "netz-assistant-input-bar";

    this.input = document.createElement("ui5-input");
    this.input.placeholder = "Ask a question…";
    this.input.style.flex = "1";
    this.input.disabled = true;

    const sendBtn = document.createElement("ui5-button");
    sendBtn.icon = "paper-plane";
    sendBtn.design = "Emphasized";
    sendBtn.tooltip = "Send";
    sendBtn.accessibleName = "Send message";
    sendBtn.disabled = true;

    inputBar.append(this.input, sendBtn);
    this.el.appendChild(inputBar);
  }

  show() {
    this.el.classList.add("netz-assistant-drawer--open");
  }

  hide() {
    this.el.classList.remove("netz-assistant-drawer--open");
  }

  get isOpen() {
    return this.el.classList.contains("netz-assistant-drawer--open");
  }
}
