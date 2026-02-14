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

    // ── Top-level: Dashboard ──
    this._addItem({ label: "Dashboard", route: "/dashboard", icon: "home" });

    // ── Investments ──
    this._addGroupHeader("Investments");
    this._addItem({ label: "Portfolio", route: "/portfolio", icon: "folder" });
    this._addItem({ label: "Deals", route: "/deals", icon: "pie-chart" });

    // ── Operations ──
    this._addGroupHeader("Operations");
    this._addItem({ label: "Cash", route: "/cash", icon: "wallet" });

    // ── Governance ──
    this._addGroupHeader("Governance");
    this._addItem({ label: "Compliance", route: "/compliance", icon: "shield" });

    // ── Documents ──
    this._addGroupHeader("Documents");
    this._addItem({ label: "Data Room", route: "/dataroom", icon: "folder" });
    this._addItem({ label: "Signatures", route: "/signatures", icon: "edit" });

    // ── Reporting ──
    this._addGroupHeader("Reporting");
    this._addItem({ label: "Reporting", route: "/reporting", icon: "pie-chart" });
  }

  _addGroupHeader(text) {
    const group = document.createElement("ui5-side-navigation-group");
    group.text = text;
    this.el.appendChild(group);
    this._currentGroup = group;
  }

  _addItem({ label, route, icon }) {
    const navItem = document.createElement("ui5-side-navigation-item");
    navItem.text = label;
    navItem.icon = icon;
    navItem.dataset.route = route;
    if (this._currentGroup) {
      this._currentGroup.appendChild(navItem);
    } else {
      this.el.appendChild(navItem);
    }
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
