export class SideNavigation {
  constructor({ onNavigate }) {
    this.el = document.createElement("ui5-side-navigation");
    this.el.className = "netz-side-nav";
    this.el.accessibleName = "Primary navigation";

    this.el.addEventListener("selection-change", (e) => {
      const item = e.detail?.item;
      const route = item?.dataset?.route;
      if (route) onNavigate(route);
    });

    [
      { label: "Dashboard", route: "/dashboard", icon: "home" },
      { label: "Portfolio", route: "/portfolio", icon: "folder" },
      { label: "Deals Pipeline", route: "/deals", icon: "pie-chart" },
      { label: "Documents", route: "/documents", icon: "documents" },
      { label: "Dataroom", route: "/dataroom", icon: "folder" },
      { label: "Cash Management", route: "/cash", icon: "wallet" },
      { label: "Compliance", route: "/compliance", icon: "shield" },
      { label: "Actions", route: "/actions", icon: "sys-enter-2" },
      { label: "AI", route: "/ai", icon: "ai" },
      { label: "Reporting", route: "/reporting", icon: "pie-chart" },
      { label: "Signatures", route: "/signatures", icon: "edit" },
      { label: "Assets", route: "/assets", icon: "product" },
      { label: "Alerts", route: "/alerts", icon: "alert" },
      { label: "Portfolio Actions", route: "/portfolio-actions", icon: "action" },
      { label: "Fund Investment", route: "/fund-investment", icon: "add-equipment" },
      { label: "Asset Obligations", route: "/asset-obligations", icon: "receipt" },
      { label: "Evidence", route: "/evidence", icon: "document-text" },
      { label: "Auditor Evidence", route: "/auditor-evidence", icon: "inspection" },
      { label: "Report Packs", route: "/report-packs", icon: "business-card" },
      { label: "Investor Portal", route: "/investor-portal", icon: "customer" },
      { label: "NAV Assets", route: "/nav-assets", icon: "table-chart" }
    ].forEach((it) => {
      const navItem = document.createElement("ui5-side-navigation-item");
      navItem.text = it.label;
      navItem.icon = it.icon;
      navItem.dataset.route = it.route;
      this.el.appendChild(navItem);
    });
  }

  setSelectedRoute(routePath) {
    const items = Array.from(this.el.querySelectorAll("ui5-side-navigation-item"));
    for (const item of items) {
      if (item.dataset.route === routePath) {
        this.el.selectedItem = item;
        return;
      }
    }
  }

  setCollapsed(collapsed) {
    this.el.collapsed = Boolean(collapsed);
  }
}
