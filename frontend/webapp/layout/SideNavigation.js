export class SideNavigation {
  constructor({ onNavigate }) {
    this.el = document.createElement("ui5-side-navigation");
    this.el.setAttribute("collapsed", "false");
    this.el.addEventListener("selection-change", (e) => {
      const item = e.detail?.item;
      const route = item?.dataset?.route;
      if (route) {
        onNavigate(route);
      }
    });

    const items = [
      { label: "Dashboard", route: "/dashboard" },
      { label: "Data Room", route: "/data-room" },
      { label: "Cash Management", route: "/cash" },
      { label: "Compliance", route: "/compliance" },
      { label: "Fund Copilot", route: "/copilot" },
      { label: "Reporting", route: "/reporting" },
    ];

    items.forEach((it) => {
      const navItem = document.createElement("ui5-side-navigation-item");
      navItem.text = it.label;
      navItem.dataset.route = it.route;
      this.el.appendChild(navItem);
    });
  }

  setSelectedRoute(routePath) {
    const candidates = Array.from(this.el.querySelectorAll("ui5-side-navigation-item"));
    for (const item of candidates) {
      if (item.dataset.route === routePath) {
        this.el.selectedItem = item;
        return;
      }
    }
  }
}
