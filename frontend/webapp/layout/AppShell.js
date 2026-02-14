import { getFundIdFromQuery } from "../services/env.js";
import { ensureAuthenticated } from "../services/apiClient.js";
import { SideNavigation } from "./SideNavigation.js";
import { AssistantDrawer } from "../components/AssistantDrawer.js";

import { DashboardPage } from "../pages/Dashboard.js";
import { DocumentsPage } from "../pages/DocumentsPage.js";
import { DataroomPage } from "../pages/DataroomPage.js";
import { CashManagementPage } from "../pages/CashManagementPage.js";
import { CompliancePage } from "../pages/CompliancePage.js";
import { ActionsPage } from "../pages/ActionsPage.js";
import { ReportingPage } from "../pages/ReportingPage.js";
import { PortfolioPage } from "../pages/PortfolioPage.js";
import { DealsPipelinePage } from "../pages/DealsPipelinePage.js";
import { SignaturesPage } from "../pages/SignaturesPage.js";
import { AdminAuditPage } from "../pages/AdminAuditPage.js";
import { SignatureDetailView } from "../workflows/SignatureDetailView.js";

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/dashboard";
  return pathname;
}

function matchSignatureDetail(pathname) {
  const m = pathname.match(/^\/cash\/signature\/([^/]+)$/);
  return m ? { transferId: decodeURIComponent(m[1]) } : null;
}

export class AppShell {
  constructor() {
    this.el = document.createElement("div");
    this.el.className = "netz-app-shell";

    this._fundId = getFundIdFromQuery();
    this._sideCollapsed = false;

    this.navLayout = document.createElement("ui5-navigation-layout");
    this.navLayout.className = "netz-nav-layout";
    this.navLayout.mode = "Auto";

    this.shellbar = document.createElement("ui5-shellbar");
    this.shellbar.primaryTitle = "Netz Fund OS";
    this.shellbar.secondaryTitle = "Private Credit";
    this.shellbar.showSearchField = true;
    this.shellbar.showNotifications = true;

    this._menuButton = document.createElement("ui5-button");
    this._menuButton.className = "netz-icon-btn";
    this._menuButton.icon = "menu2";
    this._menuButton.design = "Transparent";
    this._menuButton.tooltip = "Toggle navigation";
    this._menuButton.accessibleName = "Toggle navigation menu";
    this._menuButton.accessibilityAttributes = { hasPopup: "menu", expanded: "true" };
    this._menuButton.slot = "startButton";
    this._menuButton.addEventListener("click", () => this._toggleSideNav());
    this.shellbar.appendChild(this._menuButton);

    const logo = document.createElement("img");
    logo.src = "/logo.svg";
    logo.alt = "Netz Fund OS";
    logo.className = "netz-shell-logo";
    logo.slot = "logo";
    this.shellbar.appendChild(logo);

    const avatar = document.createElement("ui5-avatar");
    avatar.initials = "NF";
    avatar.slot = "profile";
    this.shellbar.appendChild(avatar);

    // Assistant toggle button in ShellBar
    this._assistantButton = document.createElement("ui5-button");
    this._assistantButton.icon = "ai";
    this._assistantButton.design = "Transparent";
    this._assistantButton.tooltip = "Open AI Assistant";
    this._assistantButton.accessibleName = "Toggle AI assistant panel";
    this._assistantButton.slot = "startButton";
    this._assistantButton.addEventListener("click", () => this._toggleAssistant());
    this.shellbar.appendChild(this._assistantButton);

    this.shellbar.slot = "header";
    this.navLayout.appendChild(this.shellbar);

    this._nav = new SideNavigation({ onNavigate: (p) => this.navigate(p) });
    this._nav.el.slot = "sideContent";
    this.navLayout.appendChild(this._nav.el);

    // Main content area and assistant drawer wrapper
    this._contentWrapper = document.createElement("div");
    this._contentWrapper.className = "netz-content-wrapper";

    this._contentHost = document.createElement("div");
    this._contentHost.className = "netz-content-host";
    this._contentWrapper.appendChild(this._contentHost);

    // Assistant drawer
    this._assistantDrawer = new AssistantDrawer({ onClose: () => this._toggleAssistant() });
    this._contentWrapper.appendChild(this._assistantDrawer.el);

    this.navLayout.appendChild(this._contentWrapper);

    this.el.appendChild(this.navLayout);

    window.addEventListener("popstate", () => this._renderCurrentRoute());
  }

  async start() {
    const ok = await ensureAuthenticated();
    if (!ok) {
      return;
    }
    this._renderCurrentRoute();
  }

  navigate(pathname) {
    const p = normalizePath(pathname);
    history.pushState({}, "", p + window.location.search);
    this._renderCurrentRoute();
  }

  _renderCurrentRoute() {
    const pathname = normalizePath(window.location.pathname);
    const moduleRoutes = [
      "/dashboard",
      "/portfolio",
      "/deals",
      "/documents",
      "/dataroom",
      "/cash",
      "/compliance",
      "/actions",
      "/reporting",
      "/signatures",
      "/admin",
      "/audit-log",
    ];

    if (moduleRoutes.includes(pathname)) {
      this._nav.setSelectedRoute(pathname);
    }

    const sig = matchSignatureDetail(pathname);
    if (sig) {
      this._renderPage(new SignatureDetailView({ fundId: this._fundId, transferId: sig.transferId, onNavigate: (p) => this.navigate(p) }));
      return;
    }

    switch (pathname) {
      case "/dashboard":
        this._renderPage(new DashboardPage({ fundId: this._fundId }));
        break;
      case "/portfolio":
        this._renderPage(new PortfolioPage({ fundId: this._fundId }));
        break;
      case "/deals":
        this._renderPage(new DealsPipelinePage({ fundId: this._fundId }));
        break;
      case "/documents":
        this._renderPage(new DocumentsPage({ fundId: this._fundId }));
        break;
      case "/dataroom":
      case "/data-room":
        this._renderPage(new DataroomPage({ fundId: this._fundId }));
        break;
      case "/cash":
        this._renderPage(new CashManagementPage({ fundId: this._fundId, onNavigate: (p) => this.navigate(p) }));
        break;
      case "/compliance":
        this._renderPage(new CompliancePage({ fundId: this._fundId }));
        break;
      case "/actions":
        this._renderPage(new ActionsPage({ fundId: this._fundId }));
        break;
      case "/reporting":
        this._renderPage(new ReportingPage({ fundId: this._fundId }));
        break;
      case "/signatures":
        this._renderPage(new SignaturesPage({ fundId: this._fundId }));
        break;
      case "/admin":
        this._renderPage(new AdminAuditPage({ fundId: this._fundId, mode: "admin" }));
        break;
      case "/audit-log":
        this._renderPage(new AdminAuditPage({ fundId: this._fundId, mode: "audit" }));
        break;
      default:
        this.navigate("/dashboard");
        break;
    }
  }

  _renderPage(page) {
    this._contentHost.replaceChildren(page.el);
    if (typeof page.onShow === "function") page.onShow();
  }

  _renderPlaceholderPage(title, message) {
    const page = document.createElement("ui5-dynamic-page");
    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = title;
    pageTitle.appendChild(h);
    page.appendChild(pageTitle);

    const content = document.createElement("div");
    content.className = "netz-page-content";
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = message;
    content.appendChild(strip);
    page.appendChild(content);

    this._contentHost.replaceChildren(page);
  }

  _toggleAssistant() {
    if (this._assistantDrawer.isOpen) {
      this._assistantDrawer.hide();
    } else {
      this._assistantDrawer.show();
    }
  }

  _toggleSideNav() {
    this._sideCollapsed = !this._sideCollapsed;
    this.navLayout.mode = this._sideCollapsed ? "Collapsed" : "Expanded";
    this._nav.setCollapsed(this._sideCollapsed);
    this._menuButton.accessibilityAttributes = {
      hasPopup: "menu",
      expanded: this._sideCollapsed ? "false" : "true"
    };
  }
}
