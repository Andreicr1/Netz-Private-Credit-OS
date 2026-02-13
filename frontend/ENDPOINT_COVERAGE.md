# Endpoint Coverage Matrix — Frontend vs Backend

Source baseline: `ENDPOINT_AUDIT_REPORT.md` backend inventory (Wave 5 consolidation).

Status vocabulary:
- `Covered`
- `Pending (not yet exposed)`
- `Internal-only`

| Backend Endpoint | Method | Frontend Function | Module | Wave | Status |
|---|---|---|---|---|---|
| /api/health | GET | - | Internal/System | - | Internal-only |
| /api/health/azure | GET | - | Internal/System | - | Internal-only |
| /admin/dev/seed | POST | - | Internal/System | - | Internal-only |
| /api/funds/{fund_id}/portfolio/borrowers | GET | listBorrowers | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/portfolio/borrowers | POST | createBorrower | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/portfolio/loans | GET | listLoans | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/portfolio/loans | POST | createLoan | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/portfolio/covenants | GET | listCovenants | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/portfolio/covenants | POST | createCovenant | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/portfolio/covenant-tests | POST | createCovenantTest | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/portfolio/breaches | GET | listBreaches | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/portfolio/alerts | GET | listAlerts | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/portfolio/alerts | POST | createAlert | api/portfolio.js | Wave 1 | Covered |
| /api/funds/{fund_id}/pipeline/deals | GET | listPipelineDeals | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/pipeline/deals | POST | createPipelineDeal | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/pipeline/deals/{deal_id}/stage | PATCH | updatePipelineDealStage | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/pipeline/deals/{deal_id}/decisions | POST | createPipelineDealDecision | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/pipeline/deals/qualification/run | POST | runPipelineQualification | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/execution/actions | GET | listExecutionActions | api/actions.js | Wave 2 | Covered |
| /api/funds/{fund_id}/execution/actions | POST | createExecutionAction | api/actions.js | Wave 2 | Covered |
| /api/funds/{fund_id}/execution/actions/{action_id}/status | PATCH | updateExecutionActionStatus | api/actions.js | Wave 2 | Covered |
| /api/funds/{fund_id}/execution/actions/{action_id}/evidence | POST | attachExecutionActionEvidence | api/actions.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/snapshot | GET | getComplianceSnapshot | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/me | GET | getComplianceMe | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligations | GET | listComplianceObligations | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligations/{obligation_id} | GET | getComplianceObligation | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligations/{obligation_id}/evidence | GET | listComplianceObligationEvidence | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligations/{obligation_id}/evidence/link | POST | linkComplianceObligationEvidence | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligations/{obligation_id}/workflow/mark-in-progress | POST | markComplianceObligationInProgress | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligations/{obligation_id}/workflow/close | POST | closeComplianceObligation | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligations/{obligation_id}/audit | GET | listComplianceObligationAudit | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligations | POST | createComplianceObligation | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligation-status | GET | listComplianceObligationStatus | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/obligation-status/recompute | POST | recomputeComplianceObligationStatus | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/gaps/recompute | POST | recomputeComplianceGaps | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/compliance/gaps | GET | listComplianceGaps | api/compliance.js | Wave 2 | Covered |
| /api/funds/{fund_id}/documents | POST | createDocument | api/documents.js | Wave 4 | Covered |
| /api/funds/{fund_id}/documents/{document_id}/versions | POST | createDocumentVersion | api/documents.js | Wave 4 | Covered |
| /api/funds/{fund_id}/documents/upload | POST | uploadPdf | api/documents.js | Wave 4 | Covered |
| /api/funds/{fund_id}/documents | GET | listDocuments | api/documents.js | Wave 4 | Covered |
| /api/funds/{fund_id}/documents/root-folders | GET | listRootFolders | api/documents.js | Wave 4 | Covered |
| /api/funds/{fund_id}/documents/{document_id} | GET | getDocumentById | api/documents.js | Wave 4 | Covered |
| /api/funds/{fund_id}/documents/{document_id}/versions | GET | listDocumentVersions | api/documents.js | Wave 4 | Covered |
| /api/funds/{fund_id}/documents/root-folders | POST | createRootFolder | api/documents.js | Wave 4 | Covered |
| /api/funds/{fund_id}/documents/ingestion/process-pending | POST | processPendingIngestion | api/documents.js | Wave 4 | Covered |
| /api/funds/{fund_id}/ai/activity | GET | listAIActivity | api/ai.js | Wave 4 | Covered |
| /api/funds/{fund_id}/ai/query | POST | createAIQuery | api/ai.js | Wave 4 | Covered |
| /api/funds/{fund_id}/ai/history | GET | listAIHistory | api/ai.js | Wave 4 | Covered |
| /api/funds/{fund_id}/ai/retrieve | POST | retrieveAIContext | api/ai.js | Wave 4 | Covered |
| /api/funds/{fund_id}/ai/answer | POST | answerAIQuestion | api/ai.js | Wave 4 | Covered |
| /api/funds/{fund_id}/signatures | GET | listSignatureRequests | api/signatures.js | Wave 4 | Covered |
| /api/funds/{fund_id}/signatures/{request_id} | GET | getSignatureRequest | api/signatures.js | Wave 4 | Covered |
| /api/funds/{fund_id}/signatures/{request_id}/sign | POST | signSignatureRequest | api/signatures.js | Wave 4 | Covered |
| /api/funds/{fund_id}/signatures/{request_id}/reject | POST | rejectSignatureRequest | api/signatures.js | Wave 4 | Covered |
| /api/funds/{fund_id}/signatures/{request_id}/execution-pack | POST | exportExecutionPack | api/signatures.js | Wave 4 | Covered |
| /api/funds/{fund_id}/assets | POST | createAsset | api/assets.js | Wave 6 | Covered |
| /api/funds/{fund_id}/alerts | GET | listDomainAlerts | api/alertsDomain.js | Wave 6 | Covered |
| /api/funds/{fund_id}/portfolio/actions | GET | listPortfolioActions | api/portfolioActions.js | Wave 6 | Covered |
| /api/funds/{fund_id}/portfolio/actions/{action_id} | PATCH | updatePortfolioAction | api/portfolioActions.js | Wave 6 | Covered |
| /api/funds/{fund_id}/assets/{asset_id}/fund-investment | POST | createFundInvestment | api/fundInvestments.js | Wave 6 | Covered |
| /api/funds/{fund_id}/assets/{asset_id}/fund-investment | GET | getFundInvestment | api/fundInvestments.js | Wave 6 | Covered |
| /api/funds/{fund_id}/assets/{asset_id}/obligations | POST | createAssetObligation | api/assetObligations.js | Wave 6 | Covered |
| /api/funds/{fund_id}/obligations | GET | listAssetObligations | api/assetObligations.js | Wave 6 | Covered |
| /api/funds/{fund_id}/obligations/{obligation_id} | PATCH | updateObligation | api/assetObligations.js | Wave 6 | Covered |
| /api/funds/{fund_id}/deals | POST | createDeal | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/deals | GET | listDeals | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/deals/{deal_id}/decision | PATCH | updateDealDecision | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/deals/{deal_id}/convert | POST | convertDealToAsset | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/deals/{deal_id}/ic-memo | POST | createDealIcMemo | api/deals.js | Wave 1 | Covered |
| /api/funds/{fund_id}/actions | POST | createGovernedAction | api/actions.js | Wave 2 | Covered |
| /api/funds/{fund_id}/actions | GET | listGovernedActions | api/actions.js | Wave 2 | Covered |
| /api/funds/{fund_id}/actions/{action_id} | PATCH | updateGovernedActionStatus | api/actions.js | Wave 2 | Covered |
| /api/funds/{fund_id}/evidence/upload-request | POST | createEvidenceUploadRequest | api/evidence.js | Wave 6 | Covered |
| /api/funds/{fund_id}/auditor/evidence | GET | listAuditorEvidence | api/auditorEvidence.js | Wave 6 | Covered |
| /api/funds/{fund_id}/evidence/{evidence_id}/complete | PATCH | completeEvidence | api/evidence.js | Wave 6 | Covered |
| /api/funds/{fund_id}/report-packs | POST | createReportPack | api/reportPacksLegacy.js | Wave 6 | Covered |
| /api/funds/{fund_id}/report-packs/{pack_id}/generate | POST | generateReportPack | api/reportPacksLegacy.js | Wave 6 | Covered |
| /api/funds/{fund_id}/report-packs/{pack_id}/publish | POST | publishReportPack | api/reportPacksLegacy.js | Wave 6 | Covered |
| /api/funds/{fund_id}/investor/report-packs | GET | listInvestorReportPacks | api/investorPortal.js | Wave 6 | Covered |
| /api/funds/{fund_id}/reports/evidence-pack | POST | exportEvidencePack | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/nav/snapshots | POST | createNavSnapshot | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/nav/snapshots | GET | listNavSnapshots | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id} | GET | getNavSnapshotById | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/finalize | POST | finalizeNavSnapshot | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/publish | POST | publishNavSnapshot | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/assets | POST | recordAssetValuationSnapshot | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/assets | GET | listNavSnapshotAssets | api/reporting.js | Wave 6 | Covered |
| /api/funds/{fund_id}/reports/monthly-pack/generate | POST | generateMonthlyPack | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/monthly-pack/list | GET | listMonthlyPacks | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/monthly-pack/{pack_id}/download | GET | downloadMonthlyPack | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/investor-statements/generate | POST | generateInvestorStatement | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/investor-statements | GET | listInvestorStatements | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/investor-statements/{statement_id}/download | GET | downloadInvestorStatement | api/reporting.js | Wave 4 | Covered |
| /api/funds/{fund_id}/reports/archive | GET | getReportingArchive | api/reporting.js | Wave 4 | Covered |
| /api/dataroom/documents | POST | uploadDataroomDocument | api/dataroom.js | Wave 4 | Covered |
| /api/dataroom/documents/{document_id}/ingest | POST | ingestDataroomDocument | api/dataroom.js | Wave 4 | Covered |
| /api/dataroom/search | GET | searchDataroom | api/dataroom.js | Wave 4 | Covered |
| /api/funds/{fund_id}/cash/snapshot | GET | getCashSnapshot | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions | GET | listCashTransactions | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id} | GET | getCashTransactionDetail | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions | POST | createCashTransaction | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/submit | POST | submitCashTransaction | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/submit-signature | PATCH | submitCashTransactionForSignature | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/mark-executed | PATCH | markCashTransactionExecutedPatch | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/mark-reconciled | PATCH | markCashTransactionReconciled | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/approve/director | POST | approveCashTransactionDirector | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/approve/ic | POST | approveCashTransactionIc | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/approve | POST | approveCashTransaction | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/reject | POST | rejectCashTransaction | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/generate-instructions | POST | generateCashInstructions | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/mark-sent | POST | markCashTransactionSent | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/transactions/{tx_id}/mark-executed | POST | markCashTransactionExecutedPost | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/statements/upload | POST | uploadCashStatement | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/reconciliation/unmatched | GET | listCashUnmatchedReconciliationLines | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/statements | GET | listCashStatements | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/statements/{statement_id}/lines | GET | listCashStatementLines | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/statements/{statement_id}/lines | POST | addCashStatementLine | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/reconcile | POST | runCashReconciliation | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/reconciliation/report | GET | getCashReconciliationReport | api/cash.js | Wave 3 | Covered |
| /api/funds/{fund_id}/cash/reconciliation/match | POST | matchCashReconciliationLine | api/cash.js | Wave 3 | Covered |

## Justification — Pending (not yet exposed)

No pending endpoints remain after Wave 6.

## Justification — Internal-only

| Backend Endpoint | Method | Justification |
|---|---|---|
| /api/health | GET | System health probe endpoint. |
| /api/health/azure | GET | Platform dependency health probe endpoint. |
| /admin/dev/seed | POST | Dev-only administrative seeding endpoint. |

## Summary

- Total endpoints: **120**
- Covered count: **117**
- Pending count: **0**
- Internal-only count: **3**
- Percent coverage: **97.50%**
