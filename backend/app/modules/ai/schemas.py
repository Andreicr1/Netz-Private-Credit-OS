from __future__ import annotations

import datetime as dt
import uuid
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    limit: int
    offset: int


class AIQueryCreate(BaseModel):
    query_text: str = Field(min_length=3)


class AIQueryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    actor_id: str
    query_text: str
    request_id: str
    created_at_utc: dt.datetime


class AIResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    query_id: uuid.UUID
    model_version: str
    prompt: dict
    retrieval_sources: list[dict] | None
    citations: list[dict] | None
    response_text: str | None
    created_at_utc: dt.datetime


class AIRetrieveRequest(BaseModel):
    query: str = Field(min_length=3)
    root_folder: str | None = None
    top_k: int = Field(default=5, ge=1, le=20)


class AIRetrieveResult(BaseModel):
    chunk_id: str
    document_title: str
    root_folder: str | None
    folder_path: str | None
    version_id: str
    version_number: int
    chunk_index: int | None
    excerpt: str
    source_blob: str | None


class AIRetrieveResponse(BaseModel):
    results: list[AIRetrieveResult]


class AIAnswerRequest(BaseModel):
    question: str = Field(min_length=3)
    root_folder: str | None = None
    top_k: int = Field(default=6, ge=1, le=20)


class AIAnswerCitationOut(BaseModel):
    chunk_id: str
    document_id: str
    version_id: str
    page_start: int | None
    page_end: int | None
    excerpt: str
    source_blob: str | None


class AIAnswerResponse(BaseModel):
    answer: str
    citations: list[AIAnswerCitationOut]


class AIActivityItemOut(BaseModel):
    question_id: str
    answer_id: str
    question: str | None
    asked_by: str | None
    timestamp_utc: dt.datetime | None
    insufficient_evidence: bool
    citations_count: int


class DataEnvelope(BaseModel):
    asOf: dt.datetime
    dataLatency: int | None = None
    dataQuality: str | None = None


class DocumentClassificationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    documentId: uuid.UUID = Field(validation_alias="document_id")
    versionId: uuid.UUID = Field(validation_alias="version_id")
    title: str
    rootFolder: str | None = Field(default=None, validation_alias="root_folder")
    folderPath: str | None = Field(default=None, validation_alias="folder_path")
    institutionalType: str = Field(validation_alias="institutional_type")


class DocumentClassificationResponse(DataEnvelope):
    items: list[DocumentClassificationItem]


class ManagerProfileItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    strategy: str
    region: str
    vehicleType: str = Field(validation_alias="vehicle_type")
    declaredTargetReturn: str | None = Field(default=None, validation_alias="declared_target_return")
    reportingCadence: str = Field(validation_alias="reporting_cadence")
    keyRisksDeclared: list[str] = Field(default_factory=list, validation_alias="key_risks_declared")
    lastDocumentUpdate: dt.datetime | None = Field(default=None, validation_alias="last_document_update")
    sourceDocuments: list[dict] = Field(default_factory=list, validation_alias="source_documents")


class ManagerProfileResponse(DataEnvelope):
    item: ManagerProfileItem


class ObligationRegisterItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    obligationId: str = Field(validation_alias="obligation_id")
    source: str
    obligationText: str = Field(validation_alias="obligation_text")
    frequency: str
    dueRule: str = Field(validation_alias="due_rule")
    responsibleParty: str = Field(validation_alias="responsible_party")
    evidenceExpected: str = Field(validation_alias="evidence_expected")
    status: str


class ObligationRegisterResponse(DataEnvelope):
    items: list[ObligationRegisterItem]


class GovernanceAlertItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    alertId: str = Field(validation_alias="alert_id")
    domain: str
    severity: str
    entityRef: str = Field(validation_alias="entity_ref")
    title: str
    actionableNextStep: str = Field(validation_alias="actionable_next_step")


class GovernanceAlertsResponse(DataEnvelope):
    items: list[GovernanceAlertItem]


class DailyCycleRunResponse(BaseModel):
    asOf: dt.datetime
    classifiedDocuments: int
    managerProfiles: int
    obligations: int
    alerts: int


class DocumentsIngestResponse(BaseModel):
    asOf: dt.datetime
    documentsScanned: int
    documentsClassified: int
    governanceProfiles: int
    knowledgeAnchors: int


class DocumentIndexItem(BaseModel):
    docId: uuid.UUID
    blobPath: str
    containerName: str
    domainTag: str
    lifecycleStage: str
    detectedDocType: str | None
    resolvedAuthority: str | None
    shareability: str
    auditReady: bool
    lastIngestedAt: dt.datetime


class DocumentIndexResponse(DataEnvelope):
    items: list[DocumentIndexItem]


class KnowledgeAnchorOut(BaseModel):
    anchorType: str
    anchorValue: str
    sourceSnippet: str | None
    pageReference: str | None


class DocumentDetailResponse(DataEnvelope):
    docId: uuid.UUID
    blobPath: str
    containerName: str
    domainTag: str
    lifecycleStage: str
    classification: dict
    governanceProfile: dict | None
    anchors: list[KnowledgeAnchorOut]


class PipelineIngestResponse(BaseModel):
    asOf: dt.datetime
    deals: int
    dealDocuments: int
    profiles: int
    briefs: int
    alerts: int


class PipelineDealItem(BaseModel):
    dealId: uuid.UUID
    dealName: str
    sponsorName: str | None
    lifecycleStage: str
    riskBand: str | None
    asOf: dt.datetime


class PipelineDealsResponse(DataEnvelope):
    items: list[PipelineDealItem]


class PipelineRiskFlagOut(BaseModel):
    riskType: str
    severity: str
    reasoning: str
    sourceDocument: str | None


class PipelineICBriefOut(BaseModel):
    executiveSummary: str
    opportunityOverview: str
    returnProfile: str
    downsideCase: str
    riskSummary: str
    comparisonPeerFunds: str
    recommendationSignal: str


class PipelineDealDetailResponse(DataEnvelope):
    dealId: uuid.UUID
    dealName: str
    sponsorName: str | None
    lifecycleStage: str
    profile: dict | None
    riskFlags: list[PipelineRiskFlagOut]
    icBrief: PipelineICBriefOut | None


class PipelineAlertOut(BaseModel):
    alertId: uuid.UUID
    dealId: uuid.UUID
    alertType: str
    severity: str
    description: str
    createdAt: dt.datetime
    resolvedFlag: bool


class PipelineAlertsResponse(DataEnvelope):
    items: list[PipelineAlertOut]


class PortfolioIngestResponse(BaseModel):
    asOf: dt.datetime
    investments: int
    metrics: int
    drifts: int
    covenants: int
    cashFlags: int
    riskRegistry: int
    briefs: int


class PortfolioInvestmentItem(BaseModel):
    investmentId: uuid.UUID
    investmentName: str
    managerName: str | None
    lifecycleStatus: str
    strategyType: str | None
    targetReturn: str | None
    committedCapitalUsd: float | None
    deployedCapitalUsd: float | None
    currentNavUsd: float | None
    overallRiskLevel: str | None
    asOf: dt.datetime


class PortfolioInvestmentsResponse(DataEnvelope):
    items: list[PortfolioInvestmentItem]


class PortfolioDriftOut(BaseModel):
    metricName: str
    baselineValue: float | None
    currentValue: float | None
    driftPct: float | None
    severity: str
    reasoning: str


class PortfolioCovenantOut(BaseModel):
    covenantName: str
    status: str
    severity: str
    details: str | None
    lastTestedAt: dt.datetime | None
    nextTestDueAt: dt.datetime | None


class PortfolioCashImpactOut(BaseModel):
    impactType: str
    severity: str
    estimatedImpactUsd: float | None
    liquidityDays: int | None
    message: str
    resolvedFlag: bool


class PortfolioRiskOut(BaseModel):
    riskType: str
    riskLevel: str
    trend: str | None
    rationale: str


class PortfolioBriefOut(BaseModel):
    executiveSummary: str
    performanceView: str
    covenantView: str
    liquidityView: str
    riskReclassificationView: str
    recommendedActions: list[str]
    lastGeneratedAt: dt.datetime


class PortfolioInvestmentDetailResponse(DataEnvelope):
    investmentId: uuid.UUID
    investmentName: str
    managerName: str | None
    lifecycleStatus: str
    sourceContainer: str
    sourceFolder: str
    profile: dict
    drifts: list[PortfolioDriftOut]
    covenants: list[PortfolioCovenantOut]
    cashImpacts: list[PortfolioCashImpactOut]
    risks: list[PortfolioRiskOut]
    boardBrief: PortfolioBriefOut | None


class PortfolioAlertOut(BaseModel):
    alertType: str
    severity: str
    investmentId: uuid.UUID
    investmentName: str
    message: str
    createdAt: dt.datetime


class PortfolioAlertsResponse(DataEnvelope):
    items: list[PortfolioAlertOut]

