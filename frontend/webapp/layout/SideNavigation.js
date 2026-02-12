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
      { label: "Data Room", route: "/data-room", icon: "folder" },
      { label: "Cash Management", route: "/cash", icon: "wallet" },
      { label: "Compliance", route: "/compliance", icon: "shield" },
      { label: "Fund Copilot", route: "/copilot", icon: "ai" },
      { label: "Reporting", route: "/reporting", icon: "pie-chart" }
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
