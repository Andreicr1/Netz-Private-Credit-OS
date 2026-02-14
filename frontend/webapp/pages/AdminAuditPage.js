import * as adminAuditApi from "../api/adminAudit.js";

const LATENCY_THRESHOLD = 300;

function safe(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function toItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safe(value);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safe(value);
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getAsOf(...payloads) {
  for (const payload of payloads) {
    const asOf = firstDefined(payload?.asOf, payload?.as_of, payload?.timestamp, payload?.generated_at);
    if (!asOf) continue;
    const date = new Date(asOf);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
    return safe(asOf);
  }
  return "—";
}

function getGovernanceSignal(payload, fallbackThreshold = LATENCY_THRESHOLD) {
  const latency = Number(firstDefined(payload?.dataLatency, payload?.data_latency, payload?.latency_ms));
  const threshold = Number(firstDefined(payload?.dataLatencyThreshold, payload?.latency_threshold, fallbackThreshold));
  const quality = safe(firstDefined(payload?.dataQuality, payload?.data_quality), "OK");

  if ((!Number.isNaN(latency) && !Number.isNaN(threshold) && latency > threshold) || quality !== "OK") {
    return {
      latency: Number.isNaN(latency) ? null : latency,
      threshold: Number.isNaN(threshold) ? fallbackThreshold : threshold,
      quality,
    };
  }
  return null;
}

function buildGovernanceStrip(payload) {
  const signal = getGovernanceSignal(payload);
  if (!signal) return null;

  const strip = document.createElement("ui5-message-strip");
  strip.design = "Warning";
  strip.hideCloseButton = true;
  const latencyText = signal.latency == null ? "n/a" : `${signal.latency}ms`;
  strip.textContent = `Data governance warning — latency ${latencyText} (threshold ${signal.threshold}ms), quality ${signal.quality}.`;
  return strip;
}

function setOptions(select, options, selected) {
  select.replaceChildren();
  const all = document.createElement("ui5-option");
  all.value = "";
  all.textContent = "All";
  select.appendChild(all);

  options.forEach((value) => {
    const option = document.createElement("ui5-option");
    option.value = String(value);
    option.textContent = String(value);
    if (selected && String(selected) === String(value)) option.selected = true;
    select.appendChild(option);
  });
}

function buildDenseTable(columns, rows) {
  const viewportWidth = window.innerWidth || 1440;
  const visibleColumns = viewportWidth <= 960
    ? columns.filter((column) => column.priority === "P1")
    : viewportWidth <= 1280
      ? columns.filter((column) => column.priority !== "P3")
      : columns;
  const hiddenColumns = columns.filter((column) => !visibleColumns.includes(column));

  const table = document.createElement("ui5-table");
  table.className = "netz-wave-table-dense";

  const headerRow = document.createElement("ui5-table-header-row");
  headerRow.setAttribute("slot", "headerRow");
  visibleColumns.forEach((column) => {
    const headerCell = document.createElement("ui5-table-header-cell");
    headerCell.textContent = `${column.label} ${column.priority}`;
    headerRow.appendChild(headerCell);
  });
  if (hiddenColumns.length) {
    const detailsHeader = document.createElement("ui5-table-header-cell");
    detailsHeader.textContent = "Details P1";
    headerRow.appendChild(detailsHeader);
  }
  table.appendChild(headerRow);

  rows.forEach((row) => {
    const tr = document.createElement("ui5-table-row");
    visibleColumns.forEach((column) => {
      const td = document.createElement("ui5-table-cell");
      td.textContent = safe(row[column.key]);
      tr.appendChild(td);
    });

    if (hiddenColumns.length) {
      const detailsCell = document.createElement("ui5-table-cell");
      const button = document.createElement("ui5-button");
      button.design = "Transparent";
      button.textContent = "View";

      const popover = document.createElement("ui5-responsive-popover");
      popover.headerText = "Collapsed Columns";
      const list = document.createElement("ui5-list");
      hiddenColumns.forEach((column) => {
        const item = document.createElement("ui5-li");
        item.textContent = column.label;
        item.description = safe(row[column.key]);
        list.appendChild(item);
      });
      popover.appendChild(list);
      button.addEventListener("click", () => popover.showAt(button));

      detailsCell.append(button, popover);
      tr.appendChild(detailsCell);
    }

    table.appendChild(tr);
  });

  return table;
}

function buildList(items, emptyText) {
  const list = document.createElement("ui5-list");
  if (!items.length) {
    const li = document.createElement("ui5-li");
    li.textContent = emptyText;
    list.appendChild(li);
    return list;
  }

  items.forEach((item) => {
    const li = document.createElement("ui5-li");
    li.textContent = safe(item.text);
    li.description = safe(item.description);
    list.appendChild(li);
  });
  return list;
}

export class AdminAuditPage {
  constructor({ fundId, mode = "admin" }) {
    this.fundId = fundId;
    this.mode = mode;
    this.state = {
      filters: {
        user: "",
        actionType: "",
        dateRange: "",
      },
      savedView: "DEFAULT",
      activeFiltersCount: 0,
      asOf: "—",
    };

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = mode === "audit" ? "Audit Log" : "Admin";
    pageTitle.appendChild(heading);
    this.el.appendChild(pageTitle);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = false;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content netz-wave-page";

    this.errorStrip = document.createElement("ui5-message-strip");
    this.errorStrip.design = "Negative";
    this.errorStrip.style.display = "none";
    content.appendChild(this.errorStrip);

    this.commandLayer = this._buildCommandLayer();
    this.operationalLayer = this._buildOperationalLayer();
    this.monitoringLayer = this._buildMonitoringLayer();

    content.append(this.commandLayer, this.operationalLayer, this.monitoringLayer);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _buildCommandLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 1 — Command";
    header.subtitleText = "User, action type and date range filters";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.commandGovernanceHost = document.createElement("div");
    body.appendChild(this.commandGovernanceHost);

    const bar = document.createElement("ui5-bar");
    bar.className = "netz-wave-command-bar";

    const left = document.createElement("div");
    left.setAttribute("slot", "startContent");
    const title = document.createElement("ui5-title");
    title.level = "H5";
    title.textContent = modeLabel(this.mode);
    left.appendChild(title);

    const right = document.createElement("div");
    right.className = "netz-wave-command-meta";
    right.setAttribute("slot", "endContent");

    this.activeFiltersTag = document.createElement("ui5-tag");
    this.activeFiltersTag.design = "Information";
    right.appendChild(this.activeFiltersTag);

    this.asOfTag = document.createElement("ui5-tag");
    this.asOfTag.design = "Neutral";
    right.appendChild(this.asOfTag);

    bar.append(left, right);

    const controls = document.createElement("div");
    controls.className = "netz-wave-command-controls";

    this.userSelect = document.createElement("ui5-select");
    this.userSelect.accessibleName = "User";

    this.actionTypeSelect = document.createElement("ui5-select");
    this.actionTypeSelect.accessibleName = "Action Type";

    this.dateRange = document.createElement("ui5-date-range-picker");
    this.dateRange.accessibleName = "Date Range";

    this.savedViewSelect = document.createElement("ui5-select");
    this.savedViewSelect.accessibleName = "Saved View";
    setOptions(this.savedViewSelect, ["DEFAULT", "GOVERNANCE", "OPERATIONS"], this.state.savedView);

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const clearBtn = document.createElement("ui5-button");
    clearBtn.design = "Transparent";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => this._clearFilters());

    controls.append(this.userSelect, this.actionTypeSelect, this.dateRange, this.savedViewSelect, applyBtn, clearBtn);

    body.append(bar, controls);
    card.appendChild(body);
    return card;
  }

  _buildOperationalLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 3 — Operational";
    header.subtitleText = "Audit Log Table (dense)";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.operationalGovernanceHost = document.createElement("div");
    body.appendChild(this.operationalGovernanceHost);

    this.tableHost = document.createElement("div");
    this.tableHost.className = "netz-wave-table-host";
    body.appendChild(this.tableHost);

    card.appendChild(body);
    return card;
  }

  _buildMonitoringLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 4 — Monitoring";
    header.subtitleText = "Governance Health Panel";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.monitoringGovernanceHost = document.createElement("div");
    body.appendChild(this.monitoringGovernanceHost);

    const panel = document.createElement("ui5-panel");
    panel.headerText = "Governance Health";
    this.healthHost = document.createElement("div");
    panel.appendChild(this.healthHost);

    body.appendChild(panel);
    card.appendChild(body);
    return card;
  }

  _setError(message) {
    this.errorStrip.textContent = message;
    this.errorStrip.style.display = "block";
  }

  _clearError() {
    this.errorStrip.textContent = "";
    this.errorStrip.style.display = "none";
  }

  _refreshCommandMeta() {
    this.state.activeFiltersCount = [this.state.filters.user, this.state.filters.actionType, this.state.filters.dateRange].filter(Boolean).length;
    this.activeFiltersTag.textContent = `activeFiltersCount ${this.state.activeFiltersCount}`;
    this.asOfTag.textContent = `asOf ${this.state.asOf}`;
  }

  _applyFilters() {
    this.state.savedView = String(this.savedViewSelect.selectedOption?.value || "DEFAULT");
    this.state.filters = {
      user: this.userSelect.selectedOption?.value || "",
      actionType: this.actionTypeSelect.selectedOption?.value || "",
      dateRange: this.dateRange.value || "",
    };
    this.onShow();
  }

  _clearFilters() {
    this.state.filters = { user: "", actionType: "", dateRange: "" };
    this.state.savedView = "DEFAULT";
    this.dateRange.value = "";
    this.onShow();
  }

  _setLayerGovernance(host, payload) {
    host.replaceChildren();
    const strip = buildGovernanceStrip(payload);
    if (strip) host.appendChild(strip);
  }

  _renderOperational(rows) {
    const columns = [
      { key: "timestampUtc", label: "Timestamp (UTC)", priority: "P1" },
      { key: "actor", label: "Actor", priority: "P1" },
      { key: "role", label: "Role", priority: "P2" },
      { key: "action", label: "Action", priority: "P1" },
      { key: "entityType", label: "Entity Type", priority: "P2" },
      { key: "entityId", label: "Entity ID", priority: "P1" },
      { key: "beforeStateHash", label: "Before State Hash", priority: "P3" },
      { key: "afterStateHash", label: "After State Hash", priority: "P3" },
      { key: "status", label: "Status", priority: "P1" },
      { key: "ipAddress", label: "IP Address", priority: "P2" },
    ];

    const tableRows = rows.map((row) => ({
      timestampUtc: firstDefined(row.timestamp_utc, row.timestamp, row.created_at, row.updated_at),
      actor: firstDefined(row.actor, row.owner, row.owner_name, row.assignee, row.created_by),
      role: firstDefined(row.role, row.actor_role, row.user_role),
      action: firstDefined(row.action, row.title, row.name, row.workflow_action),
      entityType: firstDefined(row.entity_type, row.domain, row.category, "action"),
      entityId: firstDefined(row.entity_id, row.id, row.reference_id, row.trace_id),
      beforeStateHash: firstDefined(row.before_state_hash, row.before_hash),
      afterStateHash: firstDefined(row.after_state_hash, row.after_hash),
      status: firstDefined(row.status, row.workflow_status),
      ipAddress: firstDefined(row.ip_address, row.client_ip, row.source_ip),
    }));

    this.tableHost.replaceChildren(buildDenseTable(columns, tableRows));
  }

  _renderMonitoring(healthPayload, azurePayload) {
    const healthItems = [];

    Object.entries(healthPayload || {}).forEach(([key, value]) => {
      healthItems.push({ text: key, description: safe(value) });
    });

    Object.entries(azurePayload || {}).forEach(([key, value]) => {
      healthItems.push({ text: `azure.${key}`, description: safe(value) });
    });

    this.healthHost.replaceChildren(buildList(healthItems, "No governance health data."));
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
      const [executionEvents, governedEvents, platformHealth, azureHealth] = await Promise.all([
        adminAuditApi.listAdminAuditEvents(this.fundId, {
          limit: 100,
          offset: 0,
          owner: this.state.filters.user,
          action_type: this.state.filters.actionType,
          date_range: this.state.filters.dateRange,
          saved_view: this.state.savedView,
        }),
        adminAuditApi.listGovernedAuditEvents(this.fundId),
        adminAuditApi.getPlatformHealth(),
        adminAuditApi.getAzureHealth(),
      ]);

      const rows = [...toItems(executionEvents), ...toItems(governedEvents)].filter((row) => {
        const user = this.state.filters.user;
        const actionType = this.state.filters.actionType;

        const userMatch = !user || String(firstDefined(row.owner, row.owner_name, row.assignee, row.created_by, "")) === user;
        const actionMatch = !actionType || String(firstDefined(row.action, row.status, row.workflow_action, "")).toLowerCase().includes(actionType.toLowerCase());

        if (!this.state.filters.dateRange) {
          return userMatch && actionMatch;
        }

        const ts = firstDefined(row.created_at, row.updated_at, row.timestamp);
        const dateText = ts ? formatDate(ts) : "";
        return userMatch && actionMatch && (!dateText || String(this.state.filters.dateRange).includes(dateText));
      });

      this.state.asOf = getAsOf(executionEvents, governedEvents);
      this._refreshCommandMeta();

      setOptions(
        this.userSelect,
        [...new Set(rows.map((row) => firstDefined(row.owner, row.owner_name, row.assignee, row.created_by)).filter(Boolean))],
        this.state.filters.user,
      );

      setOptions(
        this.actionTypeSelect,
        [...new Set(rows.map((row) => firstDefined(row.action, row.workflow_action, row.status)).filter(Boolean))],
        this.state.filters.actionType,
      );

      this._setLayerGovernance(this.commandGovernanceHost, executionEvents);
      this._setLayerGovernance(this.operationalGovernanceHost, governedEvents);
      this._setLayerGovernance(this.monitoringGovernanceHost, azureHealth);

      this._renderOperational(rows);
      this._renderMonitoring(platformHealth, azureHealth);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load admin/audit data");
    } finally {
      this.busy.active = false;
    }
  }
}

function modeLabel(mode) {
  return mode === "audit" ? "Audit Command" : "Admin Command";
}
