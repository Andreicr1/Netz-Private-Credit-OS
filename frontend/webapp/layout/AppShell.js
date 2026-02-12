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
  if (!pathname || pathname === "/") return "/dashboard";
  return pathname;
}

function matchSignatureDetail(pathname) {
  const m = pathname.match(/^\/cash\/signature\/([^/]+)$/);
  return m ? { transferId: decodeURIComponent(m[1]) } : null;
}

function isStaticWebAppsHost() {
  try {
    const host = (window.location && window.location.hostname) || "";
    return host.includes("azurestaticapps.net");
  } catch (e) {
    return false;
  }
}

function getClientPrincipal(payload) {
  if (Array.isArray(payload)) {
    if (payload.length === 0) return null;
    return payload[0] && payload[0].clientPrincipal ? payload[0].clientPrincipal : null;
  }
  return payload && payload.clientPrincipal ? payload.clientPrincipal : null;
}

async function ensureAuthenticated() {
  if (!isStaticWebAppsHost()) {
    return true;
  }

  try {
    const res = await fetch("/.auth/me", { method: "GET", credentials: "include" });
    const payload = res.ok ? await res.json() : null;
    const principal = getClientPrincipal(payload);
    if (principal) {
      return true;
    }
  } catch (e) {
  }

  const currentPath = `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;
  window.location.replace(`/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(currentPath)}`);
  return false;
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
    const moduleRoutes = ["/dashboard", "/data-room", "/cash", "/compliance", "/copilot", "/reporting"];

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
