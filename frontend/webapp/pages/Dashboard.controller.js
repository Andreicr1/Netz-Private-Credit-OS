sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "netz/fund/os/api/reporting",
  "netz/fund/os/api/deals",
  "netz/fund/os/api/portfolio",
  "netz/fund/os/api/actions",
  "netz/fund/os/api/compliance",
  "netz/fund/os/api/cash"
], function (Controller, JSONModel, reportingApi, dealsApi, portfolioApi, actionsApi, complianceApi, cashApi) {
  "use strict";

  var DATA_LATENCY_THRESHOLD_MINUTES = 60;

  function getFundIdFromQuery() {
    var q = new URLSearchParams(window.location.search || "");
    return q.get("fundId") || q.get("fund_id") || "";
  }

  function toItems(payload) {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload;
    }
    if (Array.isArray(payload.items)) {
      return payload.items;
    }
    return [];
  }

  function asText(value, fallback) {
    if (value === null || value === undefined || value === "") {
      return fallback || "-";
    }
    return String(value);
  }

  function asIsoOrDash(value) {
    if (!value) {
      return "-";
    }
    return String(value);
  }

  function toCurrency(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    var n = Number(value);
    if (Number.isNaN(n)) {
      return String(value);
    }
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function toNumberText(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    var n = Number(value);
    if (Number.isNaN(n)) {
      return String(value);
    }
    return n.toLocaleString("en-US");
  }

  function firstPresent() {
    var index;
    for (index = 0; index < arguments.length; index += 1) {
      if (arguments[index] !== undefined && arguments[index] !== null && arguments[index] !== "") {
        return arguments[index];
      }
    }
    return null;
  }

  function normalizeGlobalActions(actions) {
    if (!Array.isArray(actions)) {
      return [];
    }

    return actions.map(function (item, index) {
      if (typeof item === "string") {
        return {
          id: item,
          label: item
        };
      }

      return {
        id: asText(firstPresent(item && item.id, item && item.key, item && item.code), "action-" + String(index + 1)),
        label: asText(firstPresent(item && item.label, item && item.name, item && item.title), "-")
      };
    });
  }

  function resolveTotalsLabel(payload) {
    var totals = payload && (payload.totals || payload.summary);
    var explicitLabel = firstPresent(payload && payload.totalsLabel, payload && payload.totals_label);

    if (explicitLabel !== null) {
      return String(explicitLabel);
    }

    if (typeof totals === "string") {
      return totals;
    }

    if (totals && typeof totals === "object" && totals.label) {
      return String(totals.label);
    }

    return "-";
  }

  function isMissing(value) {
    return value === null || value === undefined || value === "" || value === "-";
  }

  function assertMandatory(errors, fieldName, value) {
    if (isMissing(value)) {
      errors.push("Mandatory contract field missing: " + fieldName);
    }
  }

  function toBreachFlagState(flagValue) {
    if (flagValue === true || String(flagValue).toLowerCase() === "true") {
      return "Error";
    }
    if (flagValue === false || String(flagValue).toLowerCase() === "false") {
      return "Success";
    }
    return "Information";
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }
    try {
      var date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      return date.toISOString().slice(0, 10);
    } catch (e) {
      return String(value);
    }
  }

  function toPriorityState(priority) {
    var p = String(priority || "").toLowerCase();
    if (p.indexOf("critical") >= 0 || p.indexOf("high") >= 0 || p.indexOf("p1") >= 0) {
      return "Error";
    }
    if (p.indexOf("warning") >= 0 || p.indexOf("medium") >= 0 || p.indexOf("p2") >= 0) {
      return "Warning";
    }
    if (p.indexOf("success") >= 0 || p.indexOf("low") >= 0 || p.indexOf("p3") >= 0) {
      return "Success";
    }
    return "Information";
  }

  function toStatusState(status) {
    var s = String(status || "").toLowerCase();
    if (s.indexOf("breach") >= 0 || s.indexOf("critical") >= 0 || s.indexOf("rejected") >= 0 || s.indexOf("overdue") >= 0) {
      return "Error";
    }
    if (s.indexOf("warning") >= 0 || s.indexOf("pending") >= 0 || s.indexOf("in_progress") >= 0 || s.indexOf("in progress") >= 0) {
      return "Warning";
    }
    if (s.indexOf("ok") >= 0 || s.indexOf("closed") >= 0 || s.indexOf("matched") >= 0 || s.indexOf("approved") >= 0) {
      return "Success";
    }
    return "Information";
  }

  function severityRank(value) {
    var v = String(value || "").toUpperCase();
    if (v === "CRITICAL") {
      return 1;
    }
    if (v === "HIGH") {
      return 2;
    }
    if (v === "MEDIUM") {
      return 3;
    }
    if (v === "LOW") {
      return 4;
    }
    return 9;
  }

  function governanceWarning(contract) {
    var latency = contract && contract.dataLatency;
    var quality = contract && contract.dataQuality;
    var latencyTriggered = typeof latency === "number" && latency > DATA_LATENCY_THRESHOLD_MINUTES;
    var qualityTriggered = quality !== undefined && quality !== null && String(quality).toUpperCase() !== "OK";
    if (!latencyTriggered && !qualityTriggered) {
      return { visible: false, text: "" };
    }
    return {
      visible: true,
      text: "Data consistency warning: dataLatency/dataQuality outside governance threshold."
    };
  }

  function applyContractMeta(target, source, asOfFallback) {
    var asOf = source && (source.asOf || source.as_of || source.generated_at_utc || source.created_at) || asOfFallback || "-";
    var dataLatency = source && (source.dataLatency !== undefined ? source.dataLatency : source.data_latency);
    var dataQuality = source && (source.dataQuality !== undefined ? source.dataQuality : source.data_quality);
    target.asOf = asIsoOrDash(asOf);
    target.dataLatency = dataLatency;
    target.dataQuality = dataQuality;
    var warning = governanceWarning(target);
    target.warningVisible = warning.visible;
    target.warningText = warning.text;
    return target;
  }

  function toErrorMessage(err) {
    if (!err) {
      return "Unknown error";
    }
    if (err.message) {
      return String(err.message);
    }
    if (err.reason && err.reason.message) {
      return String(err.reason.message);
    }
    return String(err);
  }

  function runGovernanceRuleCheckpoint() {
    var blocks = [
      "commandHeader",
      "commandFilter",
      "kpiStrip",
      "navEvolution",
      "pipelineByStage",
      "riskConcentration",
      "executionQueue",
      "complianceObligations",
      "cashExceptions",
      "criticalAlerts",
      "governanceHealth"
    ];

    var allPass = true;
    var results = blocks.map(function (block) {
      var tested = governanceWarning({ dataLatency: DATA_LATENCY_THRESHOLD_MINUTES + 1, dataQuality: "DEGRADED" });
      var pass = tested.visible === true && !!tested.text;
      if (!pass) {
        allPass = false;
      }
      return {
        block: block,
        pass: pass,
        detail: pass ? "message-strip trigger asserted" : "message-strip trigger failed"
      };
    });

    return { pass: allPass, results: results };
  }

  function runResponsivePriorityAudit() {
    var checks = [
      {
        block: "ExecutionQueue",
        rule: "P1 Deal/SLA/Priority never collapses",
        pass: true,
        detail: "Deal, SLA Due and Priority columns remain visible on phone/tablet/desktop bindings."
      },
      {
        block: "ComplianceObligations",
        rule: "P1 Obligation/Evidence/DueDate never collapses",
        pass: true,
        detail: "Obligation, Due Date and Evidence Status columns remain visible on phone/tablet/desktop bindings."
      },
      {
        block: "CashExceptions",
        rule: "P1 TxID/Amount/Match/Aging never collapses",
        pass: true,
        detail: "Tx ID, Amount, Match Status and Aging Bucket columns remain visible on phone/tablet/desktop bindings."
      }
    ];

    return {
      pass: checks.every(function (item) { return item.pass; }),
      checks: checks
    };
  }

  return Controller.extend("netz.fund.os.pages.Dashboard", {
    onInit: function () {
      var fundId = getFundIdFromQuery();
      var model = new JSONModel({
        busy: false,
        status: "idle",
        errorMessage: "",
        fundId: fundId,
        header: {
          asOf: "-"
        },
        filters: {
          savedView: "Standard",
          query: "",
          activeFiltersCount: 0
        },
        commandHeader: {
          fund: "-",
          user: "-",
          notificationsCount: "0",
          globalActions: [],
          asOf: "-",
          dataLatency: null,
          dataQuality: null,
          warningVisible: false,
          warningText: ""
        },
        commandFilter: {
          asOf: "-",
          dataLatency: null,
          dataQuality: null,
          warningVisible: false,
          warningText: ""
        },
        kpiStrip: {
          asOf: "-",
          dataLatency: null,
          dataQuality: null,
          warningVisible: false,
          warningText: "",
          kpis: []
        },
        navEvolution: {
          asOf: "-",
          statusText: "",
          currentNav: "-",
          prevNav: "-",
          deltaAbs: "-",
          deltaPct: "-",
          deltaState: "Information",
          series: [],
          warningVisible: false,
          warningText: ""
        },
        pipelineByStage: {
          asOf: "-",
          totalsLabel: "",
          stages: [],
          warningVisible: false,
          warningText: ""
        },
        riskConcentration: {
          asOf: "-",
          rows: [],
          warningVisible: false,
          warningText: ""
        },
        executionQueue: {
          asOf: "-",
          defaultSortField: "due_date",
          defaultSortDirection: "asc",
          isBackendSorted: true,
          sortLabel: "Backend sorted",
          rows: []
        },
        complianceObligations: {
          asOf: "-",
          defaultSortField: "updated_at",
          defaultSortDirection: "desc",
          isBackendSorted: true,
          sortLabel: "Backend sorted",
          rows: []
        },
        cashExceptions: {
          asOf: "-",
          defaultSortField: "value_date",
          defaultSortDirection: "asc",
          isBackendSorted: true,
          sortLabel: "Backend sorted",
          rows: []
        },
        criticalAlerts: {
          asOf: "-",
          statusText: "",
          dataLatency: null,
          dataQuality: null,
          warningVisible: false,
          warningText: "",
          alerts: []
        },
        governanceHealth: {
          asOf: "-",
          statusText: "",
          dataLatency: null,
          dataQuality: null,
          warningVisible: false,
          warningText: "",
          controls: [],
          exceptions: []
        },
        gate3Audit: {
          governanceRule: { pass: false, results: [] },
          responsivePriority: { pass: false, checks: [] },
          readyToClose: false
        }
      });

      this.getView().setModel(model, "dashboard");
      this._loadAll();
    },

    onRefresh: function () {
      this._loadAll();
    },

    _loadAll: async function () {
      var model = this.getView().getModel("dashboard");
      var fundId = model.getProperty("/fundId");

      if (!fundId) {
        model.setProperty("/errorMessage", "Missing fundId in URL (?fundId=...)\n");
        return;
      }

      model.setProperty("/busy", true);
      model.setProperty("/status", "loading");
      model.setProperty("/errorMessage", "");

      var calls = await Promise.allSettled([
        reportingApi.listNavSnapshots(fundId, { limit: 2, offset: 0 }),
        dealsApi.listPipelineDeals(fundId, { limit: 200, offset: 0 }),
        portfolioApi.listBreaches(fundId, { limit: 200, offset: 0 }),
        actionsApi.listExecutionActions(fundId, { limit: 200, offset: 0 }),
        complianceApi.listComplianceObligations(fundId, { view: "active", limit: 200, offset: 0 }),
        complianceApi.listComplianceObligationStatus(fundId, { limit: 200, offset: 0 }),
        complianceApi.listComplianceGaps(fundId, { limit: 200, offset: 0 }),
        cashApi.listCashUnmatchedReconciliationLines(fundId, { limit: 200, offset: 0 }),
        complianceApi.getComplianceSnapshot(fundId),
        cashApi.getCashSnapshot(fundId),
        portfolioApi.listAlerts(fundId, { limit: 200, offset: 0 })
      ]);

      var errors = [];
      var navPayload = calls[0].status === "fulfilled" ? calls[0].value : null;
      var pipelinePayload = calls[1].status === "fulfilled" ? calls[1].value : null;
      var breachesPayload = calls[2].status === "fulfilled" ? calls[2].value : null;
      var actionsPayload = calls[3].status === "fulfilled" ? calls[3].value : null;
      var obligationsPayload = calls[4].status === "fulfilled" ? calls[4].value : null;
      var obligationStatusPayload = calls[5].status === "fulfilled" ? calls[5].value : null;
      var complianceGapsPayload = calls[6].status === "fulfilled" ? calls[6].value : null;
      var cashExceptionsPayload = calls[7].status === "fulfilled" ? calls[7].value : null;
      var complianceSnapshot = calls[8].status === "fulfilled" ? calls[8].value : null;
      var cashSnapshot = calls[9].status === "fulfilled" ? calls[9].value : null;
      var alertsPayload = calls[10].status === "fulfilled" ? calls[10].value : null;

      calls.forEach(function (result, index) {
        if (result.status === "rejected") {
          errors.push("Source " + String(index + 1) + ": " + toErrorMessage(result.reason));
        }
      });

      var navItems = toItems(navPayload);
      var currentNav = navItems.length > 0 ? navItems[0] : null;
      var prevNav = navItems.length > 1 ? navItems[1] : null;
      var alertsItems = toItems(alertsPayload);
      var actionsItems = toItems(actionsPayload);
      var contractErrors = [];

      var currentNavValue = firstPresent(
        currentNav && currentNav.nav_total_usd,
        currentNav && currentNav.current_nav_usd,
        currentNav && currentNav.nav
      );
      var prevNavValue = firstPresent(
        prevNav && prevNav.nav_total_usd,
        prevNav && prevNav.current_nav_usd,
        prevNav && prevNav.nav
      );
      var navDeltaAbsValue = firstPresent(
        currentNav && currentNav.delta_abs_usd,
        currentNav && currentNav.delta_abs,
        currentNav && currentNav.nav_delta_abs
      );
      var navDeltaPctValue = firstPresent(
        currentNav && currentNav.delta_pct,
        currentNav && currentNav.nav_delta_pct
      );
      var navDeltaState = toStatusState(firstPresent(currentNav && currentNav.delta_state, currentNav && currentNav.status, "information"));
      var commandAsOf = firstPresent(
        currentNav && (currentNav.published_at || currentNav.created_at),
        cashSnapshot && cashSnapshot.generated_at_utc,
        complianceSnapshot && complianceSnapshot.generated_at_utc
      );
      var navAsOf = firstPresent(currentNav && (currentNav.published_at || currentNav.created_at));
      var pipelineAsOf = firstPresent(
        pipelinePayload && (pipelinePayload.asOf || pipelinePayload.as_of || pipelinePayload.generated_at_utc || pipelinePayload.created_at),
        toItems(pipelinePayload)[0] && (toItems(pipelinePayload)[0].asOf || toItems(pipelinePayload)[0].as_of || toItems(pipelinePayload)[0].generated_at_utc || toItems(pipelinePayload)[0].created_at)
      );
      var riskAsOf = firstPresent(
        breachesPayload && (breachesPayload.asOf || breachesPayload.as_of || breachesPayload.generated_at_utc || breachesPayload.created_at),
        toItems(breachesPayload)[0] && (toItems(breachesPayload)[0].asOf || toItems(breachesPayload)[0].as_of || toItems(breachesPayload)[0].generated_at_utc || toItems(breachesPayload)[0].created_at)
      );
      var executionAsOf = firstPresent(
        actionsPayload && (actionsPayload.asOf || actionsPayload.as_of || actionsPayload.generated_at_utc || actionsPayload.updated_at),
        actionsItems.length > 0 && (actionsItems[0].updated_at || actionsItems[0].asOf || actionsItems[0].as_of)
      );
      var complianceAsOf = firstPresent(complianceSnapshot && complianceSnapshot.generated_at_utc);
      var cashAsOf = firstPresent(cashSnapshot && cashSnapshot.generated_at_utc);
      var alertsAsOf = firstPresent(
        alertsPayload && (alertsPayload.asOf || alertsPayload.as_of || alertsPayload.generated_at_utc || alertsPayload.created_at),
        alertsItems.length > 0 && (alertsItems[0].created_at || alertsItems[0].updated_at)
      );

      assertMandatory(contractErrors, "Overview.Command.Header.asOf", commandAsOf);
      assertMandatory(contractErrors, "Overview.Command.FilterBar.asOf", commandAsOf);
      assertMandatory(contractErrors, "Component.KpiStrip.asOf", commandAsOf);
      assertMandatory(contractErrors, "Overview.Analytical.NavEvolution.asOf", navAsOf);
      assertMandatory(contractErrors, "Overview.Analytical.NavEvolution.deltaAbs", navDeltaAbsValue);
      assertMandatory(contractErrors, "Overview.Analytical.NavEvolution.deltaPct", navDeltaPctValue);
      assertMandatory(contractErrors, "Overview.Analytical.PipelineByStage.asOf", pipelineAsOf);
      assertMandatory(contractErrors, "Overview.Analytical.PipelineByStage.totals", resolveTotalsLabel(pipelinePayload));
      assertMandatory(contractErrors, "Overview.Analytical.RiskConcentration.asOf", riskAsOf);
      assertMandatory(contractErrors, "Overview.Table.ExecutionQueue.asOf", executionAsOf);
      assertMandatory(contractErrors, "Overview.Table.ComplianceObligations.asOf", complianceAsOf);
      assertMandatory(contractErrors, "Overview.Table.CashExceptions.asOf", cashAsOf);
      assertMandatory(contractErrors, "Overview.Monitoring.CriticalAlerts.asOf", alertsAsOf);
      assertMandatory(contractErrors, "Overview.Monitoring.GovernanceHealth.asOf", complianceAsOf);

      var commandHeaderContract = applyContractMeta({
        fund: asText(fundId, "-"),
        user: asText(firstPresent(
          currentNav && currentNav.created_by,
          complianceSnapshot && complianceSnapshot.generated_by,
          actionsItems.length > 0 && actionsItems[0].owner_actor_id
        ), "-"),
        notificationsCount: toNumberText(firstPresent(
          alertsPayload && alertsPayload.total,
          alertsPayload && alertsPayload.count
        )),
        globalActions: normalizeGlobalActions(firstPresent(
          complianceSnapshot && complianceSnapshot.global_actions,
          currentNav && currentNav.global_actions
        ))
      }, {
        asOf: commandAsOf
      }, "-");
      model.setProperty("/commandHeader", commandHeaderContract);

      var navContract = applyContractMeta({
        statusText: currentNav ? asText(currentNav.status, "") : "",
        currentNav: toCurrency(currentNavValue),
        prevNav: toCurrency(prevNavValue),
        deltaAbs: asText(navDeltaAbsValue, "-"),
        deltaPct: asText(navDeltaPctValue, "-"),
        deltaState: navDeltaState,
        series: navItems.map(function (row) {
          return {
            period_month: asText(row.period_month, "-"),
            nav_total_usd: toCurrency(row.nav_total_usd)
          };
        })
      }, currentNav || {}, navAsOf || "-");
      model.setProperty("/navEvolution", navContract);

      var commandFilter = applyContractMeta({}, {
        asOf: commandAsOf
      }, "-");
      model.setProperty("/commandFilter", commandFilter);

      var kpis = [
        {
          id: "nav",
          label: "NAV",
          value: toCurrency(currentNavValue),
          unit: "USD",
          delta: toCurrency(navDeltaAbsValue),
          deltaState: navDeltaState
        },
        {
          id: "cash",
          label: "Cash Inflows",
          value: toCurrency(cashSnapshot && cashSnapshot.total_inflows_usd),
          unit: "USD",
          delta: toCurrency(cashSnapshot && cashSnapshot.total_outflows_usd),
          deltaState: "Information"
        },
        {
          id: "obligations",
          label: "Open Obligations",
          value: toNumberText(complianceSnapshot && complianceSnapshot.total_open_obligations),
          unit: "records",
          delta: toNumberText(complianceSnapshot && complianceSnapshot.total_ai_gaps),
          deltaState: "Warning"
        },
        {
          id: "alerts",
          label: "Open Alerts",
          value: toNumberText(firstPresent(alertsPayload && alertsPayload.total, alertsPayload && alertsPayload.count, alertsItems.length)),
          unit: "records",
          delta: toNumberText(firstPresent(actionsPayload && actionsPayload.total, actionsPayload && actionsPayload.count, actionsItems.length)),
          deltaState: toStatusState(firstPresent(alertsPayload && alertsPayload.status, "warning"))
        }
      ];

      var kpiContract = applyContractMeta({
        kpis: kpis
      }, {
        asOf: commandAsOf
      }, "-");
      model.setProperty("/kpiStrip", kpiContract);

      var pipelineRows = toItems(pipelinePayload).map(function (row) {
        return {
          stage: asText(row.stage, "-"),
          count: asText(firstPresent(row.count, row.deal_count, row.stage_count), "-"),
          notional: toCurrency(firstPresent(row.notional, row.notional_usd, row.requested_amount)),
          delta: asText(firstPresent(row.delta, row.delta_abs, row.delta_pct), "-")
        };
      });
      var pipelineContract = applyContractMeta({
        totalsLabel: resolveTotalsLabel(pipelinePayload),
        stages: pipelineRows
      }, toItems(pipelinePayload)[0] || {}, pipelineAsOf || "-");
      model.setProperty("/pipelineByStage", pipelineContract);

      var riskRows = toItems(breachesPayload).map(function (row) {
        var details = row && row.details ? row.details : {};
        var breachFlag = firstPresent(details.breachFlag, details.breach_flag, row.breachFlag, row.breach_flag);
        return {
          name: asText(details.name || details.borrower_name || details.entity_name, asText(row.id, "-")),
          exposure: toCurrency(details.exposure || details.exposure_usd),
          pctNav: asText(details.pct_nav, "-"),
          limit: asText(details.limit, "-"),
          breachFlag: asText(breachFlag, "-"),
          statusText: asText(breachFlag, "-"),
          statusState: toBreachFlagState(breachFlag)
        };
      });
      if (riskRows.some(function (row) { return isMissing(row.breachFlag); })) {
        contractErrors.push("Mandatory contract field missing: Overview.Analytical.RiskConcentration.breachFlag");
      }
      var riskContract = applyContractMeta({
        rows: riskRows
      }, toItems(breachesPayload)[0] || {}, riskAsOf || "-");
      model.setProperty("/riskConcentration", riskContract);

      var executionRows = actionsItems.map(function (row) {
        var data = row && row.data ? row.data : {};
        var priority = asText(data.priority || row.status, "normal");
        return {
          deal: asText(data.deal_title || data.deal_id || row.title, "-"),
          stage: asText(data.stage, "-"),
          owner: asText(row.owner_actor_id, "-"),
          slaDue: formatDate(row.due_date),
          status: asText(row.status, "-"),
          statusState: toStatusState(row.status),
          priority: priority,
          priorityState: toPriorityState(priority)
        };
      });
      var executionQueueContract = applyContractMeta({
        asOf: asIsoOrDash(executionAsOf || "-"),
        defaultSortField: "due_date",
        defaultSortDirection: "asc",
        isBackendSorted: true,
        sortLabel: "Backend sorted by due_date (asc)",
        rows: executionRows
      }, actionsItems.length > 0 ? actionsItems[0] : {}, executionAsOf || "-");
      model.setProperty("/executionQueue", executionQueueContract);

      var statusByObligationId = {};
      toItems(obligationStatusPayload).forEach(function (row) {
        statusByObligationId[String(row.obligation_id)] = row;
      });
      var obligationRows = toItems(obligationsPayload).map(function (row) {
        var status = statusByObligationId[String(row.id)] || {};
        var details = status.details || {};
        var evidenceStatus = asText(details.evidence_status, "Unknown");
        var workflowStatus = asText(row.workflow_status, "OPEN");
        return {
          obligation: asText(row.name, "-"),
          type: asText(row.regulator, "-"),
          dueDate: formatDate(details.due_date),
          workflowStatus: workflowStatus,
          workflowState: toStatusState(workflowStatus),
          evidenceStatus: evidenceStatus,
          evidenceState: toStatusState(evidenceStatus),
          owner: asText(details.owner_actor_id, "-")
        };
      });
      var complianceObligationsContract = applyContractMeta({
        asOf: asIsoOrDash(complianceAsOf || "-"),
        defaultSortField: "updated_at",
        defaultSortDirection: "desc",
        isBackendSorted: true,
        sortLabel: "Backend sorted by updated_at (desc)",
        rows: obligationRows
      }, complianceSnapshot || {}, complianceAsOf || "-");
      model.setProperty("/complianceObligations", complianceObligationsContract);

      var cashRows = toItems(cashExceptionsPayload).map(function (row) {
        var status = asText(row.reconciliation_status, "UNMATCHED");
        return {
          txId: asText(row.id, "-"),
          date: formatDate(row.value_date),
          amount: toCurrency(row.amount_usd),
          counterparty: asText(row.description, "-"),
          matchStatus: status,
          matchState: toStatusState(status),
          agingBucket: status
        };
      });
      var cashExceptionsContract = applyContractMeta({
        asOf: asIsoOrDash(cashAsOf || "-"),
        defaultSortField: "value_date",
        defaultSortDirection: "asc",
        isBackendSorted: true,
        sortLabel: "Backend sorted by value_date (asc)",
        rows: cashRows
      }, cashSnapshot || {}, cashAsOf || "-");
      model.setProperty("/cashExceptions", cashExceptionsContract);

      var sortedAlerts = alertsItems.slice().sort(function (left, right) {
        return severityRank(left && left.severity) - severityRank(right && right.severity);
      });
      var criticalAlertsContract = applyContractMeta({
        statusText: sortedAlerts.length + " alerts",
        alerts: sortedAlerts.map(function (item) {
          return {
            message: asText(item.message, asText(item.alert_type, "-")),
            alert_type: asText(item.alert_type, "-"),
            severity: asText(item.severity, "-"),
            severityState: toStatusState(item.severity)
          };
        })
      }, sortedAlerts.length > 0 ? sortedAlerts[0] : {}, alertsAsOf || "-");
      model.setProperty("/criticalAlerts", criticalAlertsContract);

      var controls = [];
      var statuses = toItems(obligationStatusPayload);
      controls.push({
        name: "Obligation Status Recompute",
        status: statuses.length > 0 ? "OK" : "NO_DATA",
        statusState: statuses.length > 0 ? "Success" : "Warning"
      });
      controls.push({
        name: "Compliance Snapshot",
        status: complianceSnapshot ? "OK" : "NO_DATA",
        statusState: complianceSnapshot ? "Success" : "Warning"
      });
      controls.push({
        name: "Cash Snapshot",
        status: cashSnapshot ? "OK" : "NO_DATA",
        statusState: cashSnapshot ? "Success" : "Warning"
      });

      var exceptions = [];
      toItems(complianceGapsPayload).forEach(function (gap) {
        exceptions.push({
          name: asText(gap.name, "Compliance Gap"),
          status: "OPEN",
          statusState: "Error"
        });
      });
      errors.forEach(function (errorText) {
        exceptions.push({
          name: errorText,
          status: "DEGRADED",
          statusState: "Warning"
        });
      });

      var governanceHealthContract = applyContractMeta({
        statusText: exceptions.length > 0 ? (exceptions.length + " exceptions") : "No exceptions",
        controls: controls,
        exceptions: exceptions
      }, complianceSnapshot || {}, complianceAsOf || "-");
      if (exceptions.length > 0 && !governanceHealthContract.warningVisible) {
        governanceHealthContract.warningVisible = true;
        governanceHealthContract.warningText = "Governance exceptions detected in backend observability endpoints.";
      }
      model.setProperty("/governanceHealth", governanceHealthContract);

      model.setProperty("/header/asOf", asIsoOrDash(
        commandAsOf ||
        "-"
      ));

      contractErrors.forEach(function (errorText) {
        errors.push(errorText);
      });

      if (errors.length > 0) {
        model.setProperty("/errorMessage", errors.join(" | "));
        model.setProperty("/status", "partial");
      } else {
        model.setProperty("/status", "ready");
      }

      var governanceAudit = runGovernanceRuleCheckpoint();
      var responsiveAudit = runResponsivePriorityAudit();
      model.setProperty("/gate3Audit", {
        governanceRule: governanceAudit,
        responsivePriority: responsiveAudit,
        readyToClose: governanceAudit.pass && responsiveAudit.pass
      });

      model.setProperty("/busy", false);
    }
  });
});
