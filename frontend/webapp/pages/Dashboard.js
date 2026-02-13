import * as reportingApi from "../api/reporting.js";
import * as cashApi from "../api/cash.js";
import * as complianceApi from "../api/compliance.js";
import * as dealsApi from "../api/deals.js";
import * as portfolioApi from "../api/portfolio.js";
import * as alertsDomainApi from "../api/alertsDomain.js";
import * as signaturesApi from "../api/signatures.js";

/* ══════════════════════════════════════════════════════════════
   Board-Level Executive Dashboard
   SAP S/4HANA Launchpad — Analytical Overview Page Style
   ══════════════════════════════════════════════════════════════ */

/* ── Formatting helpers ── */

function safe(v, fallback) {
  return v != null && v !== "" ? String(v) : (fallback ?? "\u2014");
}

function fmtCurrency(v) {
  if (v == null || v === "") return "\u2014";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  if (Math.abs(n) >= 1e6) {
    return `$${(n / 1e6).toFixed(1)}M`;
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return "\u2014";
  return `${Number(v).toFixed(1)}%`;
}

function fmtDate(v) {
  if (!v) return "\u2014";
  try {
    const d = new Date(v);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return String(v);
  }
}

function toArray(data) {
  if (!data) return [];
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

/* ── Section Title (SAP Launchpad style) ── */

function makeSectionTitle(text) {
  const row = document.createElement("div");
  row.className = "netz-board-section-title";
  const t = document.createElement("ui5-title");
  t.level = "H4";
  t.textContent = text;
  row.appendChild(t);
  return row;
}

/* ── Empty State (institutional) ── */

function makeEmptyState(icon, message, hint) {
  const wrap = document.createElement("div");
  wrap.className = "netz-board-empty-state";
  const ic = document.createElement("ui5-icon");
  ic.name = icon;
  ic.className = "netz-board-empty-icon";
  wrap.appendChild(ic);
  const msg = document.createElement("ui5-label");
  msg.className = "netz-board-empty-msg";
  msg.textContent = message;
  wrap.appendChild(msg);
  if (hint) {
    const h = document.createElement("ui5-label");
    h.className = "netz-board-empty-hint";
    h.textContent = hint;
    wrap.appendChild(h);
  }
  return wrap;
}

/* ── Hero KPI Card (NAV-style with delta) ── */

function makeHeroCard({ icon, title, value, subtitle, delta, deltaLabel, statusDesign }) {
  const card = document.createElement("ui5-card");
  card.className = "netz-board-hero-card";

  const header = document.createElement("ui5-card-header");
  header.titleText = title;
  header.setAttribute("slot", "header");
  if (icon) {
    const ic = document.createElement("ui5-icon");
    ic.name = icon;
    ic.setAttribute("slot", "avatar");
    header.appendChild(ic);
  }
  if (statusDesign) {
    const tag = document.createElement("ui5-tag");
    tag.design = statusDesign;
    tag.textContent = statusDesign === "Positive" ? "Active" : statusDesign;
    tag.setAttribute("slot", "action");
    header.appendChild(tag);
  }
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "netz-board-hero-body";

  const mainRow = document.createElement("div");
  mainRow.className = "netz-board-hero-main";
  const num = document.createElement("ui5-title");
  num.level = "H1";
  num.textContent = value;
  num.className = "netz-board-hero-value";
  mainRow.appendChild(num);

  if (delta != null) {
    const deltaWrap = document.createElement("div");
    deltaWrap.className = "netz-board-hero-delta";
    const deltaNum = document.createElement("ui5-label");
    const deltaVal = Number(delta);
    deltaNum.className = deltaVal >= 0 ? "netz-board-delta-positive" : "netz-board-delta-negative";
    deltaNum.textContent = (deltaVal >= 0 ? "+" : "") + fmtCurrency(deltaVal);
    deltaWrap.appendChild(deltaNum);
    if (deltaLabel) {
      const dl = document.createElement("ui5-label");
      dl.className = "netz-board-delta-label";
      dl.textContent = deltaLabel;
      deltaWrap.appendChild(dl);
    }
    mainRow.appendChild(deltaWrap);
  }
  body.appendChild(mainRow);

  if (subtitle) {
    const sub = document.createElement("ui5-label");
    sub.className = "netz-board-hero-subtitle";
    sub.textContent = subtitle;
    body.appendChild(sub);
  }

  card.appendChild(body);
  return card;
}

/* ── Metric Card (Cash Available / Utilization style) ── */

function makeMetricCard({ icon, title, value, subtitle, secondaryLabel, secondaryValue }) {
  const card = document.createElement("ui5-card");
  card.className = "netz-board-metric-card";

  const header = document.createElement("ui5-card-header");
  header.titleText = title;
  header.setAttribute("slot", "header");
  if (icon) {
    const ic = document.createElement("ui5-icon");
    ic.name = icon;
    ic.setAttribute("slot", "avatar");
    header.appendChild(ic);
  }
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "netz-board-metric-body";

  const valEl = document.createElement("ui5-title");
  valEl.level = "H2";
  valEl.textContent = value;
  valEl.className = "netz-board-metric-value";
  body.appendChild(valEl);

  if (subtitle) {
    const sub = document.createElement("ui5-label");
    sub.className = "netz-board-metric-subtitle";
    sub.textContent = subtitle;
    body.appendChild(sub);
  }

  if (secondaryLabel && secondaryValue) {
    const secRow = document.createElement("div");
    secRow.className = "netz-board-metric-secondary";
    const sl = document.createElement("ui5-label");
    sl.textContent = secondaryLabel;
    sl.className = "netz-board-metric-sec-label";
    secRow.appendChild(sl);
    const sv = document.createElement("ui5-label");
    sv.textContent = secondaryValue;
    sv.className = "netz-board-metric-sec-value";
    secRow.appendChild(sv);
    body.appendChild(secRow);
  }

  card.appendChild(body);
  return card;
}

/* ── List Card (Queue / Attention items) ── */

function makeListCard({ icon, title, count, items, emptyIcon, emptyMsg, emptyHint }) {
  const card = document.createElement("ui5-card");
  card.className = "netz-board-list-card";

  const header = document.createElement("ui5-card-header");
  header.titleText = title;
  if (count != null) {
    header.subtitleText = `${count} item${count !== 1 ? "s" : ""}`;
  }
  header.setAttribute("slot", "header");
  if (icon) {
    const ic = document.createElement("ui5-icon");
    ic.name = icon;
    ic.setAttribute("slot", "avatar");
    header.appendChild(ic);
  }
  if (count != null && count > 0) {
    const tag = document.createElement("ui5-tag");
    tag.design = count > 3 ? "Critical" : count > 0 ? "Warning" : "Positive";
    tag.textContent = String(count);
    tag.setAttribute("slot", "action");
    header.appendChild(tag);
  }
  card.appendChild(header);

  if (!items || items.length === 0) {
    card.appendChild(makeEmptyState(emptyIcon || "sys-enter-2", emptyMsg || "No items", emptyHint));
    return card;
  }

  const list = document.createElement("ui5-list");
  list.separators = "Inner";
  items.slice(0, 5).forEach((item) => {
    const li = document.createElement("ui5-li");
    li.textContent = item.text || "\u2014";
    if (item.description) li.description = item.description;
    if (item.icon) li.icon = item.icon;
    if (item.highlight) li.setAttribute("highlight", item.highlight);
    list.appendChild(li);
  });
  card.appendChild(list);
  return card;
}

/* ── Mini Table Card (Concentration / Off-Contract Spend style) ── */

function makeMiniTableCard({ icon, title, subtitle, columns, rows, emptyIcon, emptyMsg, emptyHint }) {
  const card = document.createElement("ui5-card");
  card.className = "netz-board-table-card";

  const header = document.createElement("ui5-card-header");
  header.titleText = title;
  if (subtitle) header.subtitleText = subtitle;
  header.setAttribute("slot", "header");
  if (icon) {
    const ic = document.createElement("ui5-icon");
    ic.name = icon;
    ic.setAttribute("slot", "avatar");
    header.appendChild(ic);
  }
  card.appendChild(header);

  if (!rows || rows.length === 0) {
    card.appendChild(makeEmptyState(emptyIcon || "table-chart", emptyMsg || "No data available", emptyHint));
    return card;
  }

  const table = document.createElement("ui5-table");
  table.className = "netz-board-mini-table";

  columns.forEach((col) => {
    const hc = document.createElement("ui5-table-header-cell");
    hc.textContent = col.label;
    if (col.width) hc.width = col.width;
    table.appendChild(hc);
  });

  rows.slice(0, 5).forEach((row) => {
    const tr = document.createElement("ui5-table-row");
    row.cells.forEach((cellData, idx) => {
      const td = document.createElement("ui5-table-cell");
      if (cellData.highlight) {
        const span = document.createElement("span");
        span.style.color = cellData.highlight === "Critical"
          ? "var(--sapNegativeTextColor)"
          : cellData.highlight === "Warning"
            ? "var(--sapCriticalTextColor)"
            : "var(--sapPositiveTextColor)";
        span.style.fontWeight = "600";
        span.textContent = cellData.text;
        td.appendChild(span);
      } else {
        td.textContent = cellData.text || "\u2014";
      }
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  card.appendChild(table);
  return card;
}

/* ── Stage Pipeline Card (Deals by stage) ── */

function makePipelineStageCard({ icon, title, stages, totalLabel, totalValue }) {
  const card = document.createElement("ui5-card");
  card.className = "netz-board-pipeline-card";

  const header = document.createElement("ui5-card-header");
  header.titleText = title;
  header.setAttribute("slot", "header");
  if (icon) {
    const ic = document.createElement("ui5-icon");
    ic.name = icon;
    ic.setAttribute("slot", "avatar");
    header.appendChild(ic);
  }
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "netz-board-pipeline-body";

  if (!stages || stages.length === 0) {
    body.appendChild(makeEmptyState("lead", "No pipeline deals", "Deals will appear as they enter screening"));
    card.appendChild(body);
    return card;
  }

  const stagesWrap = document.createElement("div");
  stagesWrap.className = "netz-board-pipeline-stages";

  stages.forEach((stage) => {
    const col = document.createElement("div");
    col.className = "netz-board-pipeline-stage";

    const countEl = document.createElement("ui5-title");
    countEl.level = "H2";
    countEl.textContent = String(stage.count);
    countEl.className = "netz-board-pipeline-count";
    col.appendChild(countEl);

    const label = document.createElement("ui5-label");
    label.textContent = stage.label;
    label.className = "netz-board-pipeline-label";
    col.appendChild(label);

    if (stage.volume) {
      const vol = document.createElement("ui5-label");
      vol.textContent = stage.volume;
      vol.className = "netz-board-pipeline-vol";
      col.appendChild(vol);
    }

    stagesWrap.appendChild(col);
  });
  body.appendChild(stagesWrap);

  if (totalLabel && totalValue) {
    const totalRow = document.createElement("div");
    totalRow.className = "netz-board-pipeline-total";
    const tl = document.createElement("ui5-label");
    tl.textContent = totalLabel;
    tl.className = "netz-board-pipeline-total-label";
    totalRow.appendChild(tl);
    const tv = document.createElement("ui5-title");
    tv.level = "H3";
    tv.textContent = totalValue;
    tv.className = "netz-board-pipeline-total-value";
    totalRow.appendChild(tv);
    body.appendChild(totalRow);
  }

  card.appendChild(body);
  return card;
}

/* ══════════════════════════════════════════════════════════════
   Dashboard Page
   ══════════════════════════════════════════════════════════════ */

export class DashboardPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    /* Page title */
    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Fund Overview";
    pageTitle.appendChild(heading);

    const subHeading = document.createElement("ui5-label");
    subHeading.textContent = "Board-Level Command Center";
    subHeading.className = "netz-board-page-subtitle";
    pageTitle.appendChild(subHeading);

    this.el.appendChild(pageTitle);

    /* Header — fund scope */
    const pageHeader = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = this.fundId
      ? `Fund: ${this.fundId}`
      : "No fund scope set. Provide ?fundId= in the URL.";
    pageHeader.appendChild(strip);
    this.el.appendChild(pageHeader);

    /* Busy indicator */
    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = true;
    this.busy.style.width = "100%";

    /* Content container */
    this.content = document.createElement("div");
    this.content.className = "netz-page-content netz-board-content";
    this.busy.appendChild(this.content);
    this.el.appendChild(this.busy);
  }

  async onShow() {
    this.busy.active = true;
    this.content.replaceChildren();

    if (!this.fundId) {
      this.busy.active = false;
      return;
    }

    try {
      /* ── Parallel data fetch — all read-only backend endpoints ── */
      const [
        navSnaps,
        cashSnap,
        compSnap,
        pipelineDeals,
        alerts,
        breaches,
        cashTxs,
        obligations,
        sigRequests,
        borrowers,
      ] = await Promise.all([
        reportingApi.listNavSnapshots(this.fundId, { limit: 2, offset: 0 }).catch(() => null),
        cashApi.getCashSnapshot(this.fundId).catch(() => null),
        complianceApi.getComplianceSnapshot(this.fundId).catch(() => null),
        dealsApi.listPipelineDeals(this.fundId, { limit: 50 }).catch(() => null),
        alertsDomainApi.listDomainAlerts(this.fundId).catch(() => null),
        portfolioApi.listBreaches(this.fundId, { limit: 10, offset: 0 }).catch(() => null),
        cashApi.listCashTransactions(this.fundId, { limit: 50, offset: 0 }).catch(() => null),
        complianceApi.listComplianceObligations(this.fundId).catch(() => null),
        signaturesApi.listSignatureRequests(this.fundId, { limit: 20 }).catch(() => null),
        portfolioApi.listBorrowers(this.fundId).catch(() => null),
      ]);

      /* ══════════════════════════════════════════════════════
         ROW 1 — CAPITAL OVERVIEW
         Grid: 2fr 1fr 1fr (hero NAV spans 2 cols conceptually)
         ══════════════════════════════════════════════════════ */
      this.content.appendChild(makeSectionTitle("Capital"));

      const capitalRow = document.createElement("div");
      capitalRow.className = "netz-board-row netz-board-row-capital";

      // NAV Hero Card (spans 2 cols)
      const navItems = toArray(navSnaps);
      const latestNav = navItems[0];
      const priorNav = navItems[1];
      const navValue = latestNav?.total_nav ?? latestNav?.nav_total ?? null;
      const priorNavValue = priorNav?.total_nav ?? priorNav?.nav_total ?? null;
      const navDelta = navValue != null && priorNavValue != null ? navValue - priorNavValue : null;
      const snapshotDate = latestNav?.snapshot_date ?? latestNav?.created_at ?? null;

      capitalRow.appendChild(
        makeHeroCard({
          icon: "bar-chart",
          title: "Net Asset Value",
          value: fmtCurrency(navValue),
          subtitle: snapshotDate ? `Snapshot: ${fmtDate(snapshotDate)}` : "Latest snapshot",
          delta: navDelta,
          deltaLabel: "vs prior snapshot",
          statusDesign: "Positive",
        })
      );

      // Cash Available (% of NAV)
      const cashBal = cashSnap?.available_balance ?? cashSnap?.balance ?? null;
      const cashPctNav = cashBal != null && navValue != null && navValue > 0
        ? (cashBal / navValue) * 100
        : null;

      capitalRow.appendChild(
        makeMetricCard({
          icon: "wallet",
          title: "Cash Available",
          value: fmtCurrency(cashBal),
          subtitle: cashPctNav != null ? `${fmtPct(cashPctNav)} of NAV` : "Available balance",
          secondaryLabel: "Currency",
          secondaryValue: "USD",
        })
      );

      // Fund Utilization (% invested)
      const investedAmt = cashBal != null && navValue != null ? navValue - cashBal : null;
      const utilPct = investedAmt != null && navValue != null && navValue > 0
        ? (investedAmt / navValue) * 100
        : null;

      capitalRow.appendChild(
        makeMetricCard({
          icon: "pie-chart",
          title: "Fund Utilization",
          value: utilPct != null ? fmtPct(utilPct) : "\u2014",
          subtitle: investedAmt != null ? `${fmtCurrency(investedAmt)} deployed` : "Invested capital",
          secondaryLabel: "Target",
          secondaryValue: "100%",
        })
      );

      this.content.appendChild(capitalRow);

      /* ══════════════════════════════════════════════════════
         ROW 2 — PORTFOLIO RISK
         Grid: 1fr 1fr 2fr
         ══════════════════════════════════════════════════════ */
      this.content.appendChild(makeSectionTitle("Risk"));

      const riskRow = document.createElement("div");
      riskRow.className = "netz-board-row netz-board-row-risk";

      // Breaches count + severity tags
      const breachItems = toArray(breaches);
      const breachByLevel = { critical: 0, warning: 0, info: 0 };
      breachItems.forEach((b) => {
        const sev = (b.severity || "warning").toLowerCase();
        if (sev === "critical" || sev === "high") breachByLevel.critical++;
        else if (sev === "info" || sev === "low") breachByLevel.info++;
        else breachByLevel.warning++;
      });

      const breachCard = document.createElement("ui5-card");
      breachCard.className = "netz-board-breach-card";
      const breachHeader = document.createElement("ui5-card-header");
      breachHeader.titleText = "Covenant Breaches";
      breachHeader.setAttribute("slot", "header");
      const breachIcon = document.createElement("ui5-icon");
      breachIcon.name = "warning";
      breachIcon.setAttribute("slot", "avatar");
      breachHeader.appendChild(breachIcon);
      breachCard.appendChild(breachHeader);

      const breachBody = document.createElement("div");
      breachBody.className = "netz-board-breach-body";
      const breachCount = document.createElement("ui5-title");
      breachCount.level = "H1";
      breachCount.textContent = String(breachItems.length);
      breachCount.className = "netz-board-breach-count";
      breachBody.appendChild(breachCount);

      const tagsWrap = document.createElement("div");
      tagsWrap.className = "netz-board-breach-tags";
      if (breachByLevel.critical > 0) {
        const t = document.createElement("ui5-tag");
        t.design = "Critical";
        t.textContent = `${breachByLevel.critical} Critical`;
        tagsWrap.appendChild(t);
      }
      if (breachByLevel.warning > 0) {
        const t = document.createElement("ui5-tag");
        t.design = "Warning";
        t.textContent = `${breachByLevel.warning} Warning`;
        tagsWrap.appendChild(t);
      }
      if (breachByLevel.info > 0) {
        const t = document.createElement("ui5-tag");
        t.design = "Information";
        t.textContent = `${breachByLevel.info} Info`;
        tagsWrap.appendChild(t);
      }
      if (breachItems.length === 0) {
        const t = document.createElement("ui5-tag");
        t.design = "Positive";
        t.textContent = "Clean";
        tagsWrap.appendChild(t);
      }
      breachBody.appendChild(tagsWrap);
      breachCard.appendChild(breachBody);
      riskRow.appendChild(breachCard);

      // Alerts Summary
      const alertItems = toArray(alerts);
      riskRow.appendChild(
        makeListCard({
          icon: "alert",
          title: "Active Alerts",
          count: alertItems.length,
          items: alertItems.slice(0, 5).map((a) => ({
            text: a.message || a.title || a.alert_type || "Alert",
            description: a.severity || a.status || "",
            icon: "alert",
            highlight: (a.severity || "").toLowerCase() === "critical" ? "Critical" : "Warning",
          })),
          emptyIcon: "sys-enter-2",
          emptyMsg: "No active alerts",
          emptyHint: "Portfolio monitoring is current",
        })
      );

      // Concentration Mini Table (Top 5 exposures)
      const borrowerItems = toArray(borrowers);
      const sortedBorrowers = [...borrowerItems]
        .map((b) => ({
          name: b.name || b.borrower_name || b.entity_name || "Unknown",
          exposure: b.total_exposure ?? b.outstanding_amount ?? b.exposure ?? b.committed_amount ?? 0,
        }))
        .sort((a, b) => Number(b.exposure) - Number(a.exposure))
        .slice(0, 5);

      const totalExposure = sortedBorrowers.reduce((sum, b) => sum + Number(b.exposure || 0), 0);

      riskRow.appendChild(
        makeMiniTableCard({
          icon: "customer",
          title: "Concentration",
          subtitle: `Top ${Math.min(5, sortedBorrowers.length)} Exposures`,
          columns: [
            { label: "Borrower" },
            { label: "Exposure", width: "120px" },
            { label: "% Total", width: "80px" },
          ],
          rows: sortedBorrowers.map((b) => ({
            cells: [
              { text: b.name },
              { text: fmtCurrency(b.exposure), highlight: Number(b.exposure) > totalExposure * 0.25 ? "Critical" : null },
              { text: totalExposure > 0 ? fmtPct((Number(b.exposure) / totalExposure) * 100) : "\u2014" },
            ],
          })),
          emptyIcon: "customer",
          emptyMsg: "No borrower data",
          emptyHint: "Borrowers will appear once portfolio is populated",
        })
      );

      this.content.appendChild(riskRow);

      /* ══════════════════════════════════════════════════════
         ROW 3 — PIPELINE & DEPLOYMENT
         Grid: 2fr 1fr 1fr
         ══════════════════════════════════════════════════════ */
      this.content.appendChild(makeSectionTitle("Deployment"));

      const deployRow = document.createElement("div");
      deployRow.className = "netz-board-row netz-board-row-deploy";

      // Deals by stage
      const dealItems = toArray(pipelineDeals);
      const stageMap = {};
      let totalDealVolume = 0;
      dealItems.forEach((d) => {
        const stage = d.stage || d.pipeline_stage || d.status || "Other";
        if (!stageMap[stage]) stageMap[stage] = { count: 0, volume: 0 };
        stageMap[stage].count++;
        const amt = Number(d.amount || d.deal_amount || d.notional || 0);
        stageMap[stage].volume += amt;
        totalDealVolume += amt;
      });

      const canonicalStages = ["Screening", "IC Review", "Approved", "Closing"];
      const stageData = canonicalStages
        .map((s) => {
          const key = Object.keys(stageMap).find((k) => k.toLowerCase().includes(s.toLowerCase().split(" ")[0])) || s;
          const data = stageMap[key] || { count: 0, volume: 0 };
          return { label: s, count: data.count, volume: data.volume > 0 ? fmtCurrency(data.volume) : null };
        });

      // Include any non-canonical stages
      Object.entries(stageMap).forEach(([key]) => {
        if (!canonicalStages.some((s) => key.toLowerCase().includes(s.toLowerCase().split(" ")[0]))) {
          stageData.push({
            label: key,
            count: stageMap[key].count,
            volume: stageMap[key].volume > 0 ? fmtCurrency(stageMap[key].volume) : null,
          });
        }
      });

      deployRow.appendChild(
        makePipelineStageCard({
          icon: "lead",
          title: "Pipeline by Stage",
          stages: stageData.filter((s) => s.count > 0),
          totalLabel: "Expected Deployment",
          totalValue: fmtCurrency(totalDealVolume),
        })
      );

      // Expected deployment volume card
      deployRow.appendChild(
        makeMetricCard({
          icon: "money-bills",
          title: "Deployment Volume",
          value: fmtCurrency(totalDealVolume),
          subtitle: `${dealItems.length} active deal${dealItems.length !== 1 ? "s" : ""}`,
          secondaryLabel: "Pipeline",
          secondaryValue: dealItems.length > 0 ? "Active" : "Empty",
        })
      );

      // Approval queue
      const approvalDeals = dealItems
        .filter((d) => {
          const stage = (d.stage || d.pipeline_stage || d.status || "").toLowerCase();
          return stage.includes("approv") || stage.includes("ic") || stage.includes("closing");
        })
        .slice(0, 5);

      deployRow.appendChild(
        makeListCard({
          icon: "action",
          title: "Pending Approvals",
          count: approvalDeals.length,
          items: approvalDeals.map((d) => ({
            text: d.name || d.deal_name || d.borrower_name || "Deal",
            description: `${d.stage || d.pipeline_stage || ""} \u2022 ${fmtCurrency(d.amount || d.deal_amount || d.notional)}`,
            icon: "lead",
          })),
          emptyIcon: "sys-enter-2",
          emptyMsg: "No deals pending approval",
          emptyHint: "Deals move here after IC review",
        })
      );

      this.content.appendChild(deployRow);

      /* ══════════════════════════════════════════════════════
         ROW 4 — GOVERNANCE & EXECUTION
         Grid: 1fr 1fr 1fr
         ══════════════════════════════════════════════════════ */
      this.content.appendChild(makeSectionTitle("Governance"));

      const govRow = document.createElement("div");
      govRow.className = "netz-board-row netz-board-row-gov";

      // Compliance obligations due soon
      const oblItems = toArray(obligations);
      const upcomingObl = oblItems
        .filter((o) => {
          const status = (o.status || "").toLowerCase();
          return status !== "closed" && status !== "completed" && status !== "cancelled";
        })
        .slice(0, 5);

      govRow.appendChild(
        makeListCard({
          icon: "shield",
          title: "Compliance Due",
          count: upcomingObl.length,
          items: upcomingObl.map((o) => ({
            text: o.title || o.obligation_title || o.name || "Obligation",
            description: o.due_date ? `Due: ${fmtDate(o.due_date)}` : (o.status || ""),
            icon: "commission-check",
            highlight: "Warning",
          })),
          emptyIcon: "sys-enter-2",
          emptyMsg: "No obligations due",
          emptyHint: "All compliance obligations are current",
        })
      );

      // Pending signatures
      const sigItems = toArray(sigRequests);
      const pendingSigs = sigItems
        .filter((s) => {
          const status = (s.status || "").toLowerCase();
          return status !== "completed" && status !== "signed" && status !== "rejected" && status !== "cancelled";
        })
        .slice(0, 5);

      govRow.appendChild(
        makeListCard({
          icon: "locked",
          title: "Pending Signatures",
          count: pendingSigs.length,
          items: pendingSigs.map((s) => ({
            text: s.title || s.document_title || s.name || "Signature Request",
            description: s.status || "",
            icon: "locked",
          })),
          emptyIcon: "sys-enter-2",
          emptyMsg: "No pending signatures",
          emptyHint: "All documents are fully executed",
        })
      );

      // Pending cash transactions above threshold
      const CASH_THRESHOLD = 100000;
      const txItems = toArray(cashTxs);
      const pendingHighTxs = txItems
        .filter((t) => {
          const status = (t.status || "").toLowerCase();
          const isPending = !["reconciled", "executed", "rejected", "cancelled"].includes(status);
          const amt = Number(t.amount || 0);
          return isPending && amt >= CASH_THRESHOLD;
        })
        .slice(0, 5);

      govRow.appendChild(
        makeListCard({
          icon: "money-bills",
          title: "Cash Transactions",
          count: pendingHighTxs.length,
          items: pendingHighTxs.map((t) => ({
            text: `${t.type || t.transaction_type || "Transfer"} \u2014 ${fmtCurrency(t.amount)}`,
            description: `${t.status || ""} \u2022 ${fmtDate(t.created_at || t.value_date)}`,
            icon: "money-bills",
            highlight: Number(t.amount || 0) >= 500000 ? "Critical" : "Warning",
          })),
          emptyIcon: "sys-enter-2",
          emptyMsg: "No high-value transactions pending",
          emptyHint: `Threshold: ${fmtCurrency(CASH_THRESHOLD)}`,
        })
      );

      this.content.appendChild(govRow);
    } catch (e) {
      const errStrip = document.createElement("ui5-message-strip");
      errStrip.design = "Negative";
      errStrip.hideCloseButton = true;
      errStrip.textContent = `Failed to load dashboard: ${e?.message || "Unknown error"}`;
      this.content.appendChild(errStrip);
    } finally {
      this.busy.active = false;
    }
  }
}
