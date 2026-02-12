import { getFundIdFromQuery } from "../services/env.js";
import { SideNavigation } from "./SideNavigation.js";

import { DashboardPage } from "../pages/Dashboard.js";
import { DataRoomPage } from "../pages/DataRoom.js";
import { CashManagementPage } from "../pages/CashManagement.js";
import { CompliancePage } from "../pages/Compliance.js";
import { FundCopilotPage } from "../pages/FundCopilot.js";
import { ReportingPage } from "../pages/Reporting.js";

import { SignatureDetailView } from "../workflows/SignatureDetailView.js";

function normalizePath(pathname) {
  if (!pathname) return "/dashboard";
  if (pathname === "/") return "/dashboard";
  return pathname;
}

function matchSignatureDetail(pathname) {
  // Hidden route: /cash/signature/:transferId
  const m = pathname.match(/^\/cash\/signature\/([^/]+)$/);
  return m ? { transferId: decodeURIComponent(m[1]) } : null;
}

export class AppShell {
  constructor() {
    this.el = document.createElement("div");
    this.el.style.height = "100%";
    this.el.style.display = "flex";
    this.el.style.flexDirection = "column";

    this._fundId = getFundIdFromQuery();

    this.shellbar = document.createElement("ui5-shellbar");
    this.shellbar.primaryTitle = "Netz Fund OS";
    this.shellbar.showNotifications = true;
    this.shellbar.showSearchField = true;
    this.shellbar.notificationsCount = "";

    const logo = document.createElement("img");
    logo.src = "/logo.svg";
    logo.alt = "Netz Fund OS";
    logo.slot = "logo";
    this.shellbar.appendChild(logo);

    const avatar = document.createElement("ui5-avatar");
    avatar.initials = "NF";
    avatar.slot = "profile";
    this.shellbar.appendChild(avatar);

    this.toolPage = document.createElement("ui5-tool-page");
    this.toolPage.style.flex = "1";
    this.toolPage.style.minHeight = "0";

    this._nav = new SideNavigation({
      onNavigate: (route) => this.navigate(route),
    });
    this._nav.el.slot = "sideContent";
    this.toolPage.appendChild(this._nav.el);

    this._contentHost = document.createElement("div");
    this._contentHost.style.height = "100%";
    this._contentHost.style.minHeight = "0";
    this._contentHost.style.overflow = "hidden";
    this._contentHost.slot = "main";
    this.toolPage.appendChild(this._contentHost);

    this.el.appendChild(this.shellbar);
    this.el.appendChild(this.toolPage);

    window.addEventListener("popstate", () => this._renderCurrentRoute());
  }

  start() {
    this._renderCurrentRoute();
  }

  navigate(pathname) {
    const p = normalizePath(pathname);
    history.pushState({}, "", p + window.location.search);
    this._renderCurrentRoute();
  }

  _renderCurrentRoute() {
    const pathname = normalizePath(window.location.pathname);

    // Keep nav selection only for true modules.
    if (["/dashboard", "/data-room", "/cash", "/compliance", "/copilot", "/reporting"].includes(pathname)) {
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
      case "/data-room":
        this._renderPage(new DataRoomPage({ fundId: this._fundId }));
        break;
      case "/cash":
        this._renderPage(new CashManagementPage({ fundId: this._fundId, onNavigate: (p) => this.navigate(p) }));
        break;
      case "/compliance":
        this._renderPage(new CompliancePage({ fundId: this._fundId }));
        break;
      case "/copilot":
        this._renderPage(new FundCopilotPage({ fundId: this._fundId }));
        break;
      case "/reporting":
        this._renderPage(new ReportingPage({ fundId: this._fundId }));
        break;
      default:
        this.navigate("/dashboard");
        break;
    }
  }

  _renderPage(page) {
    this._contentHost.replaceChildren(page.el);
    if (typeof page.onShow === "function") {
      page.onShow();
    }
  }
}
