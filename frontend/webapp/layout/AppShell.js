import { getFundIdFromQuery } from "../services/env.js";
import { ensureAuthenticated } from "../services/apiClient.js";
import { SideNavigation } from "./SideNavigation.js";

import { DashboardPage } from "../pages/Dashboard.js";
import { DocumentsPage } from "../pages/DocumentsPage.js";
import { DataroomPage } from "../pages/DataroomPage.js";
import { CashManagementPage } from "../pages/CashManagementPage.js";
import { CompliancePage } from "../pages/CompliancePage.js";
import { ActionsPage } from "../pages/ActionsPage.js";
import { AiPage } from "../pages/AiPage.js";
import { ReportingPage } from "../pages/ReportingPage.js";
import { PortfolioPage } from "../pages/PortfolioPage.js";
import { DealsPipelinePage } from "../pages/DealsPipelinePage.js";
import { SignaturesPage } from "../pages/SignaturesPage.js";
import { AssetsPage } from "../pages/AssetsPage.js";
import { AlertsPage } from "../pages/AlertsPage.js";
import { PortfolioActionsPage } from "../pages/PortfolioActionsPage.js";
import { FundInvestmentPage } from "../pages/FundInvestmentPage.js";
import { AssetObligationsPage } from "../pages/AssetObligationsPage.js";
import { EvidencePage } from "../pages/EvidencePage.js";
import { AuditorEvidencePage } from "../pages/AuditorEvidencePage.js";
import { ReportPacksLegacyPage } from "../pages/ReportPacksLegacyPage.js";
import { InvestorPortalPage } from "../pages/InvestorPortalPage.js";
import { NavAssetsPage } from "../pages/NavAssetsPage.js";
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

    this.shellbar.slot = "header";
    this.navLayout.appendChild(this.shellbar);

    this._nav = new SideNavigation({ onNavigate: (p) => this.navigate(p) });
    this._nav.el.slot = "sideContent";
    this.navLayout.appendChild(this._nav.el);

    this._contentHost = document.createElement("div");
    this._contentHost.className = "netz-content-host";
    this.navLayout.appendChild(this._contentHost);

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
      "/ai",
      "/reporting",
      "/signatures",
      "/assets",
      "/alerts",
      "/portfolio-actions",
      "/fund-investment",
      "/asset-obligations",
      "/evidence",
      "/auditor-evidence",
      "/report-packs",
      "/investor-portal",
      "/nav-assets",
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
      case "/ai":
      case "/copilot":
        this._renderPage(new AiPage({ fundId: this._fundId }));
        break;
      case "/reporting":
        this._renderPage(new ReportingPage({ fundId: this._fundId }));
        break;
      case "/signatures":
        this._renderPage(new SignaturesPage({ fundId: this._fundId }));
        break;
      case "/assets":
        this._renderPage(new AssetsPage({ fundId: this._fundId }));
        break;
      case "/alerts":
        this._renderPage(new AlertsPage({ fundId: this._fundId }));
        break;
      case "/portfolio-actions":
        this._renderPage(new PortfolioActionsPage({ fundId: this._fundId }));
        break;
      case "/fund-investment":
        this._renderPage(new FundInvestmentPage({ fundId: this._fundId }));
        break;
      case "/asset-obligations":
        this._renderPage(new AssetObligationsPage({ fundId: this._fundId }));
        break;
      case "/evidence":
        this._renderPage(new EvidencePage({ fundId: this._fundId }));
        break;
      case "/auditor-evidence":
        this._renderPage(new AuditorEvidencePage({ fundId: this._fundId }));
        break;
      case "/report-packs":
        this._renderPage(new ReportPacksLegacyPage({ fundId: this._fundId }));
        break;
      case "/investor-portal":
        this._renderPage(new InvestorPortalPage({ fundId: this._fundId }));
        break;
      case "/nav-assets":
        this._renderPage(new NavAssetsPage({ fundId: this._fundId }));
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
