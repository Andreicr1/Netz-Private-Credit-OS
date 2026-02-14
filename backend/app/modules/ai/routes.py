from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from fastapi import HTTPException
from sqlalchemy.orm import Session

from sqlalchemy import func, select

from ai_engine.classifier import classify_documents
from ai_engine.document_scanner import run_documents_ingest_pipeline
from ai_engine.knowledge_builder import build_manager_profiles
from ai_engine.monitoring import run_daily_cycle
from ai_engine.obligation_extractor import extract_obligation_register
from ai_engine.pipeline_intelligence import run_pipeline_ingest
from ai_engine.portfolio_intelligence import run_portfolio_ingest
from ai_engine.linker import get_entity_links_snapshot, get_obligation_status_snapshot, run_cross_container_linking
from app.core.db.audit import write_audit_event
from app.core.db.session import get_db
from app.core.middleware.audit import get_request_id
from app.core.security.auth import Actor
from app.core.security.dependencies import get_actor, require_readonly_allowed, require_roles
from app.modules.documents.models import Document, DocumentVersion
from app.modules.ai import service
from app.modules.ai.schemas import (
    AIQueryCreate,
    AIQueryOut,
    AIRetrieveRequest,
    AIRetrieveResponse,
    AIRetrieveResult,
    AIAnswerRequest,
    AIAnswerResponse,
    AIAnswerCitationOut,
    AIActivityItemOut,
    DailyCycleRunResponse,
    DocumentDetailResponse,
    DocumentClassificationItem,
    DocumentClassificationResponse,
    DocumentIndexItem,
    DocumentIndexResponse,
    DocumentsIngestResponse,
    GovernanceAlertItem,
    GovernanceAlertsResponse,
    KnowledgeAnchorOut,
    PipelineAlertOut,
    PipelineAlertsResponse,
    PortfolioAlertOut,
    PortfolioAlertsResponse,
    PortfolioBriefOut,
    PortfolioCashImpactOut,
    PortfolioCovenantOut,
    PortfolioDriftOut,
    PortfolioIngestResponse,
    PortfolioInvestmentDetailResponse,
    PortfolioInvestmentItem,
    PortfolioInvestmentsResponse,
    PortfolioRiskOut,
    PipelineDealDetailResponse,
    PipelineDealItem,
    PipelineDealsResponse,
    PipelineICBriefOut,
    PipelineIngestResponse,
    PipelineRiskFlagOut,
    ManagerProfileItem,
    ManagerProfileResponse,
    ObligationRegisterItem,
    ObligationRegisterResponse,
    Page,
)
from app.domain.ai.services.ai_scope import enforce_root_folder_scope, filter_hits_by_scope
from app.services.azure.foundry_responses_client import FoundryResponsesClient, safe_parse_json_object
from app.domain.compliance.services.evidence_gap import create_obligation_from_gap, detect_evidence_gap
from app.modules.ai.models import (
    AIAnswer,
    AIAnswerCitation,
    AIQuestion,
    DealDocumentIntelligence,
    DealICBrief,
    DealIntelligenceProfile,
    DealRiskFlag,
    ActiveInvestment,
    BoardMonitoringBrief,
    CashImpactFlag,
    CovenantStatusRegister,
    DocumentClassification,
    DocumentGovernanceProfile,
    DocumentRegistry,
    GovernanceAlert,
    InvestmentRiskRegistry,
    KnowledgeAnchor,
    ManagerProfile,
    ObligationRegister,
    PerformanceDriftFlag,
    PipelineAlert,
)
from app.modules.deals.models import Deal
from app.modules.documents.models import DocumentChunk
from app.services.search_index import AzureSearchChunksClient
from app.shared.enums import Role

router = APIRouter(prefix="/ai", tags=["ai"])


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _envelope_from_rows(rows: list) -> tuple[dt.datetime, int | None, str | None]:
    if not rows:
        return _utcnow(), None, "OK"
    as_of = max(getattr(r, "as_of", _utcnow()) for r in rows)
    data_latency_values = [getattr(r, "data_latency", None) for r in rows if getattr(r, "data_latency", None) is not None]
    data_latency = max(data_latency_values) if data_latency_values else None
    quality_values = [getattr(r, "data_quality", None) or "OK" for r in rows]
    quality = "OK" if all(v == "OK" for v in quality_values) else "DEGRADED"
    return as_of, data_latency, quality


def _limit(limit: int = Query(50, ge=1, le=200)) -> int:
    return limit


def _offset(offset: int = Query(0, ge=0, le=10_000)) -> int:
    return offset


@router.get("/activity", response_model=Page[AIActivityItemOut])
def activity(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
    _role_guard: Actor = Depends(require_roles([Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> Page[AIActivityItemOut]:
    # Latest answers (authoritative activity log)
    answers = list(
        db.execute(
            select(AIAnswer)
            .where(AIAnswer.fund_id == fund_id)
            .order_by(AIAnswer.created_at_utc.desc())
            .offset(offset)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    question_ids = [a.question_id for a in answers]
    by_q = {}
    if question_ids:
        qs = list(db.execute(select(AIQuestion).where(AIQuestion.fund_id == fund_id, AIQuestion.id.in_(question_ids))).scalars().all())
        by_q = {q.id: q for q in qs}

    answer_ids = [a.id for a in answers]
    citations_count_by_answer: dict[uuid.UUID, int] = {a.id: 0 for a in answers}
    if answer_ids:
        rows = list(
            db.execute(
                select(AIAnswerCitation.answer_id, func.count())
                .where(AIAnswerCitation.fund_id == fund_id, AIAnswerCitation.answer_id.in_(answer_ids))
                .group_by(AIAnswerCitation.answer_id)
            ).all()
        )
        for aid, cnt in rows:
            citations_count_by_answer[aid] = int(cnt or 0)

    items: list[AIActivityItemOut] = []
    for a in answers:
        q = by_q.get(a.question_id)
        ans_text = a.answer_text or ""
        items.append(
            AIActivityItemOut(
                question_id=str(a.question_id),
                answer_id=str(a.id),
                question=q.question_text if q else None,
                asked_by=q.actor_id if q else None,
                timestamp_utc=a.created_at_utc,
                insufficient_evidence=ans_text == "Insufficient evidence in the Data Room",
                citations_count=int(citations_count_by_answer.get(a.id, 0)),
            )
        )

    return Page(items=items, limit=limit, offset=offset)


@router.post("/query")
def create_query(
    fund_id: uuid.UUID,
    payload: AIQueryCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
):
    request_id = get_request_id() or "unknown"
    q, r = service.create_query_stub(db, fund_id=fund_id, actor=actor, payload=payload, request_id=request_id)
    return JSONResponse(
        status_code=501,
        content={
            "message": "AI query not implemented yet. Request persisted for auditability.",
            "ai_query_id": str(q.id),
            "ai_response_id": str(r.id),
            "request_id": request_id,
        },
    )


@router.get("/history", response_model=Page[AIQueryOut])
def history(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
) -> Page[AIQueryOut]:
    items = service.list_queries(db, fund_id=fund_id, limit=limit, offset=offset)
    return Page(items=items, limit=limit, offset=offset)


def _blob_path_for_response(v: DocumentVersion) -> str | None:
    """
    Prefer container-relative blob path (e.g. 'dataroom/.../v2.pdf') when possible.
    """
    if v.blob_path:
        if v.blob_path.startswith("dataroom/"):
            return v.blob_path
        return f"dataroom/{v.blob_path}"
    return None


@router.post("/retrieve", response_model=AIRetrieveResponse)
def retrieve(
    fund_id: uuid.UUID,
    payload: AIRetrieveRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _role_guard: Actor = Depends(require_roles([Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
):
    request_id = get_request_id() or "unknown"

    try:
        enforce_root_folder_scope(actor=actor, requested_root_folder=payload.root_folder)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="AI_RETRIEVAL_QUERY",
        entity_type="fund",
        entity_id=str(fund_id),
        before=None,
        after={"query": payload.query, "root_folder": payload.root_folder, "top_k": payload.top_k, "request_id": request_id},
    )
    db.commit()

    try:
        client = AzureSearchChunksClient()
        hits = client.search(q=payload.query, fund_id=str(fund_id), root_folder=payload.root_folder, top=payload.top_k)
    except Exception:
        raise HTTPException(status_code=502, detail="Search backend unavailable")

    hits = filter_hits_by_scope(actor=actor, hits=hits, get_root_folder=lambda h: getattr(h, "root_folder", None))

    # Load versions/docs to enrich response (audit-grade evidence)
    version_ids = [uuid.UUID(h.version_id) for h in hits if h.version_id]
    if version_ids:
        rows = (
            db.execute(
                select(DocumentVersion, Document)
                .join(Document, Document.id == DocumentVersion.document_id)
                .where(
                    DocumentVersion.fund_id == fund_id,
                    Document.fund_id == fund_id,
                    DocumentVersion.id.in_(version_ids),
                )
            )
            .all()
        )
        by_version: dict[uuid.UUID, tuple[DocumentVersion, Document]] = {r[0].id: (r[0], r[1]) for r in rows}
    else:
        by_version = {}

    results: list[AIRetrieveResult] = []
    for h in hits:
        vid = uuid.UUID(h.version_id) if h.version_id else None
        pair = by_version.get(vid) if vid else None
        if not pair:
            continue
        v, d = pair
        text = (h.content_text or "").strip()
        excerpt = text[:600] + ("..." if len(text) > 600 else "")
        results.append(
            AIRetrieveResult(
                chunk_id=h.chunk_id,
                document_title=d.title,
                root_folder=d.root_folder,
                folder_path=d.folder_path,
                version_id=str(v.id),
                version_number=int(v.version_number),
                chunk_index=h.chunk_index,
                excerpt=excerpt,
                source_blob=_blob_path_for_response(v),
            )
        )

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="AI_RETRIEVAL_RESULTS_RETURNED",
        entity_type="fund",
        entity_id=str(fund_id),
        before={"query": payload.query, "top_k": payload.top_k},
        after={"result_count": len(results), "chunk_ids": [r.chunk_id for r in results]},
    )
    db.commit()

    return AIRetrieveResponse(results=results)


def _read_prompt_file() -> str:
    import os

    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    p = os.path.join(base, "domain", "ai", "prompts", "fund_copilot_system.md")
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


@router.post("/answer", response_model=AIAnswerResponse)
def answer(
    fund_id: uuid.UUID,
    payload: AIAnswerRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _role_guard: Actor = Depends(require_roles([Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
):
    request_id = get_request_id() or "unknown"

    try:
        enforce_root_folder_scope(actor=actor, requested_root_folder=payload.root_folder)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="AI_ANSWER_REQUESTED",
        entity_type="fund",
        entity_id=str(fund_id),
        before=None,
        after={"question": payload.question, "root_folder": payload.root_folder, "top_k": payload.top_k, "request_id": request_id},
    )
    db.commit()

    # Retrieval (chunk-level)
    try:
        client = AzureSearchChunksClient()
        hits = client.search(q=payload.question, fund_id=str(fund_id), root_folder=payload.root_folder, top=payload.top_k)
    except Exception:
        raise HTTPException(status_code=502, detail="Search backend unavailable")

    hits = filter_hits_by_scope(actor=actor, hits=hits, get_root_folder=lambda h: getattr(h, "root_folder", None))

    retrieved_chunk_ids = [h.chunk_id for h in hits if getattr(h, "chunk_id", None)]

    q_row = AIQuestion(
        fund_id=fund_id,
        access_level="internal",
        actor_id=actor.actor_id,
        question_text=payload.question,
        root_folder=payload.root_folder,
        top_k=payload.top_k,
        request_id=request_id,
        retrieved_chunk_ids=retrieved_chunk_ids,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(q_row)
    db.flush()

    # If no evidence, persist insufficient evidence and return.
    if not retrieved_chunk_ids:
        ans_text = "Insufficient evidence in the Data Room"
        a_row = AIAnswer(
            fund_id=fund_id,
            access_level="internal",
            question_id=q_row.id,
            model_version="no-evidence",
            answer_text=ans_text,
            prompt={"question": payload.question, "root_folder": payload.root_folder, "top_k": payload.top_k},
            created_by=actor.actor_id,
            updated_by=actor.actor_id,
        )
        db.add(a_row)
        db.flush()

        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="AI_INSUFFICIENT_EVIDENCE",
            entity_type="ai_question",
            entity_id=q_row.id,
            before=None,
            after={"reason": "no_retrieval_hits"},
        )
        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="AI_ANSWER_RETURNED",
            entity_type="ai_answer",
            entity_id=a_row.id,
            before=None,
            after={"answer_len": len(ans_text), "citation_count": 0},
        )
        db.commit()
        gap = detect_evidence_gap(question=payload.question, retrieved_chunks=[])
        create_obligation_from_gap(db, fund_id=fund_id, actor_id=actor.actor_id, gap=gap)
        return AIAnswerResponse(answer=ans_text, citations=[])

    # Load chunk metadata from DB for audit-grade citations.
    chunk_rows = (
        db.execute(
            select(DocumentChunk, DocumentVersion, Document)
            .join(DocumentVersion, DocumentVersion.id == DocumentChunk.version_id)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                DocumentChunk.fund_id == fund_id,
                DocumentVersion.fund_id == fund_id,
                Document.fund_id == fund_id,
                DocumentChunk.id.in_([uuid.UUID(x) for x in retrieved_chunk_ids]),
            )
        )
        .all()
    )
    by_chunk_id = {str(r[0].id): (r[0], r[1], r[2]) for r in chunk_rows}

    evidence_items = []
    for cid in retrieved_chunk_ids:
        triple = by_chunk_id.get(cid)
        if not triple:
            continue
        c, v, d = triple
        evidence_items.append(
            {
                "chunk_id": str(c.id),
                "document_id": str(d.id),
                "version_id": str(v.id),
                "title": d.title,
                "root_folder": d.root_folder,
                "folder_path": d.folder_path,
                "page_start": c.page_start,
                "page_end": c.page_end,
                "excerpt": (c.text[:800] + ("..." if len(c.text) > 800 else "")),
                "source_blob": _blob_path_for_response(v),
            }
        )

    if not evidence_items:
        ans_text = "Insufficient evidence in the Data Room"
        a_row = AIAnswer(
            fund_id=fund_id,
            access_level="internal",
            question_id=q_row.id,
            model_version="missing-chunks",
            answer_text=ans_text,
            prompt={"question": payload.question, "root_folder": payload.root_folder, "top_k": payload.top_k},
            created_by=actor.actor_id,
            updated_by=actor.actor_id,
        )
        db.add(a_row)
        db.flush()
        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="AI_INSUFFICIENT_EVIDENCE",
            entity_type="ai_question",
            entity_id=q_row.id,
            before=None,
            after={"reason": "chunks_not_found_in_db"},
        )
        db.commit()
        gap = detect_evidence_gap(question=payload.question, retrieved_chunks=[])
        create_obligation_from_gap(db, fund_id=fund_id, actor_id=actor.actor_id, gap=gap)
        return AIAnswerResponse(answer=ans_text, citations=[])

    system_prompt = _read_prompt_file()
    user_prompt = (
        "QUESTION:\n"
        f"{payload.question}\n\n"
        "EVIDENCE CHUNKS (use ONLY these):\n"
        + "\n\n".join(
            [
                f"- chunk_id: {e['chunk_id']}\n  title: {e['title']}\n  root_folder: {e['root_folder']}\n  folder_path: {e['folder_path']}\n  pages: {e['page_start']}-{e['page_end']}\n  excerpt: {e['excerpt']}"
                for e in evidence_items
            ]
        )
    )

    try:
        client_llm = FoundryResponsesClient()
        llm = client_llm.generate_answer(system_prompt=system_prompt, user_prompt=user_prompt)
        obj = safe_parse_json_object(llm.output_text)
    except Exception:
        raise HTTPException(status_code=502, detail="LLM backend unavailable")

    ans = str(obj.get("answer") or "").strip()
    cites = obj.get("citations") or []

    # Enforce hard rules
    if not ans:
        ans = "Insufficient evidence in the Data Room"
    if ans != "Insufficient evidence in the Data Room" and (not isinstance(cites, list) or len(cites) == 0):
        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="AI_INSUFFICIENT_EVIDENCE",
            entity_type="ai_question",
            entity_id=q_row.id,
            before=None,
            after={"reason": "model_returned_no_citations"},
        )
        db.commit()
        gap = detect_evidence_gap(question=payload.question, retrieved_chunks=evidence_items)
        create_obligation_from_gap(db, fund_id=fund_id, actor_id=actor.actor_id, gap=gap)
        return AIAnswerResponse(answer="Insufficient evidence in the Data Room", citations=[])

    # Normalize citations: must reference retrieved chunk_ids
    cited_ids: list[str] = []
    for c in cites:
        if isinstance(c, dict) and c.get("chunk_id"):
            cited_ids.append(str(c["chunk_id"]))
    cited_ids = [cid for cid in cited_ids if cid in by_chunk_id]

    if ans != "Insufficient evidence in the Data Room" and len(cited_ids) == 0:
        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="AI_INSUFFICIENT_EVIDENCE",
            entity_type="ai_question",
            entity_id=q_row.id,
            before=None,
            after={"reason": "citations_not_in_retrieved_set"},
        )
        db.commit()
        gap = detect_evidence_gap(question=payload.question, retrieved_chunks=evidence_items)
        create_obligation_from_gap(db, fund_id=fund_id, actor_id=actor.actor_id, gap=gap)
        return AIAnswerResponse(answer="Insufficient evidence in the Data Room", citations=[])

    a_row = AIAnswer(
        fund_id=fund_id,
        access_level="internal",
        question_id=q_row.id,
        model_version=f"azure-foundry-responses:{llm.model}",
        answer_text=ans if ans else "Insufficient evidence in the Data Room",
        prompt={"system": system_prompt, "user": user_prompt},
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(a_row)
    db.flush()

    out_citations: list[AIAnswerCitationOut] = []
    for cid in cited_ids:
        c_row, v_row, d_row = by_chunk_id[cid]
        excerpt = (c_row.text[:600] + ("..." if len(c_row.text) > 600 else ""))
        src = _blob_path_for_response(v_row)
        db.add(
            AIAnswerCitation(
                fund_id=fund_id,
                access_level="internal",
                answer_id=a_row.id,
                chunk_id=c_row.id,
                document_id=d_row.id,
                version_id=v_row.id,
                page_start=c_row.page_start,
                page_end=c_row.page_end,
                excerpt=excerpt,
                source_blob=src,
                created_by=actor.actor_id,
                updated_by=actor.actor_id,
            )
        )
        out_citations.append(
            AIAnswerCitationOut(
                chunk_id=str(c_row.id),
                document_id=str(d_row.id),
                version_id=str(v_row.id),
                page_start=c_row.page_start,
                page_end=c_row.page_end,
                excerpt=excerpt,
                source_blob=src,
            )
        )

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="AI_ANSWER_RETURNED",
        entity_type="ai_answer",
        entity_id=a_row.id,
        before=None,
        after={"answer_len": len(ans), "citation_count": len(out_citations)},
    )
    db.commit()

    return AIAnswerResponse(answer=ans, citations=out_citations)


@router.get("/documents/classification", response_model=DocumentClassificationResponse)
def get_documents_classification(
    fund_id: uuid.UUID,
    path: str | None = Query(default=None),
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> DocumentClassificationResponse:
    rows = classify_documents(db, fund_id=fund_id, path=path, actor_id=actor.actor_id)
    as_of, data_latency, data_quality = _envelope_from_rows(rows)
    items = [DocumentClassificationItem.model_validate(row) for row in rows]
    return DocumentClassificationResponse(asOf=as_of, dataLatency=data_latency, dataQuality=data_quality, items=items)


@router.get("/managers/profile", response_model=ManagerProfileResponse)
def get_manager_profile(
    fund_id: uuid.UUID,
    manager: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> ManagerProfileResponse:
    build_manager_profiles(db, fund_id=fund_id, manager=manager, actor_id=actor.actor_id)
    row = db.execute(
        select(ManagerProfile).where(
            ManagerProfile.fund_id == fund_id,
            func.lower(ManagerProfile.name) == manager.strip().lower(),
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Manager profile not found")

    as_of, data_latency, data_quality = _envelope_from_rows([row])
    return ManagerProfileResponse(
        asOf=as_of,
        dataLatency=data_latency,
        dataQuality=data_quality,
        item=ManagerProfileItem.model_validate(row),
    )


@router.get("/obligations/register", response_model=ObligationRegisterResponse)
def get_obligation_register(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> ObligationRegisterResponse:
    extract_obligation_register(db, fund_id=fund_id, actor_id=actor.actor_id)
    rows = list(
        db.execute(
            select(ObligationRegister)
            .where(ObligationRegister.fund_id == fund_id)
            .order_by(ObligationRegister.as_of.desc())
        ).scalars().all()
    )
    as_of, data_latency, data_quality = _envelope_from_rows(rows)
    items = [ObligationRegisterItem.model_validate(row) for row in rows]
    return ObligationRegisterResponse(asOf=as_of, dataLatency=data_latency, dataQuality=data_quality, items=items)


@router.get("/alerts/daily", response_model=GovernanceAlertsResponse)
def get_daily_alerts(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> GovernanceAlertsResponse:
    rows = list(
        db.execute(
            select(GovernanceAlert)
            .where(GovernanceAlert.fund_id == fund_id)
            .order_by(GovernanceAlert.as_of.desc())
            .limit(200)
        ).scalars().all()
    )
    as_of, data_latency, data_quality = _envelope_from_rows(rows)
    items = [GovernanceAlertItem.model_validate(row) for row in rows]
    return GovernanceAlertsResponse(asOf=as_of, dataLatency=data_latency, dataQuality=data_quality, items=items)


@router.post("/run-daily-cycle", response_model=DailyCycleRunResponse)
def run_ai_daily_cycle(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN])),
) -> DailyCycleRunResponse:
    result = run_daily_cycle(db, fund_id=fund_id, actor_id=actor.actor_id)
    as_of = dt.datetime.fromisoformat(str(result["asOf"]))
    return DailyCycleRunResponse(
        asOf=as_of,
        classifiedDocuments=int(result["classifiedDocuments"]),
        managerProfiles=int(result["managerProfiles"]),
        obligations=int(result["obligations"]),
        alerts=int(result["alerts"]),
    )


@router.post("/documents/ingest", response_model=DocumentsIngestResponse)
def ingest_documents_index(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.COMPLIANCE, Role.GP])),
) -> DocumentsIngestResponse:
    result = run_documents_ingest_pipeline(db, fund_id=fund_id, actor_id=actor.actor_id)
    now = _utcnow()
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="AI2_DOCUMENT_INGEST_PIPELINE",
        entity_type="fund",
        entity_id=str(fund_id),
        before=None,
        after=result,
    )
    db.commit()
    return DocumentsIngestResponse(
        asOf=now,
        documentsScanned=int(result["documentsScanned"]),
        documentsClassified=int(result["documentsClassified"]),
        governanceProfiles=int(result["governanceProfiles"]),
        knowledgeAnchors=int(result["knowledgeAnchors"]),
    )


@router.post("/linker/run")
def run_linker(
    fund_id: uuid.UUID,
    as_of: dt.datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM])),
) -> dict:
    effective_as_of = as_of or _utcnow()
    return run_cross_container_linking(db, fund_id=fund_id, actor_id=actor.actor_id, as_of=effective_as_of)


@router.get("/linker/links")
def get_linker_links(
    fund_id: uuid.UUID,
    entity_id: uuid.UUID,
    as_of: dt.datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> dict:
    effective_as_of = as_of or _utcnow()
    return get_entity_links_snapshot(db, fund_id=fund_id, entity_id=entity_id, as_of=effective_as_of)


@router.get("/linker/obligations/status")
def get_linker_obligation_status(
    fund_id: uuid.UUID,
    as_of: dt.datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> dict:
    effective_as_of = as_of or _utcnow()
    return get_obligation_status_snapshot(db, fund_id=fund_id, as_of=effective_as_of)


@router.get("/documents/index", response_model=DocumentIndexResponse)
def get_documents_index(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.COMPLIANCE, Role.GP, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> DocumentIndexResponse:
    docs = list(
        db.execute(
            select(DocumentRegistry)
            .where(DocumentRegistry.fund_id == fund_id)
            .order_by(DocumentRegistry.last_ingested_at.desc())
        ).scalars().all()
    )

    classifications = list(
        db.execute(
            select(DocumentClassification).where(DocumentClassification.fund_id == fund_id)
        ).scalars().all()
    )
    governance_profiles = list(
        db.execute(
            select(DocumentGovernanceProfile).where(DocumentGovernanceProfile.fund_id == fund_id)
        ).scalars().all()
    )
    anchors = list(
        db.execute(
            select(KnowledgeAnchor.doc_id, func.count())
            .where(KnowledgeAnchor.fund_id == fund_id)
            .group_by(KnowledgeAnchor.doc_id)
        ).all()
    )

    by_doc_classification = {row.doc_id: row for row in classifications}
    by_doc_profile = {row.doc_id: row for row in governance_profiles}
    anchors_count = {doc_id: int(count or 0) for doc_id, count in anchors}

    items: list[DocumentIndexItem] = []
    for doc in docs:
        classification = by_doc_classification.get(doc.id)
        profile = by_doc_profile.get(doc.id)
        items.append(
            DocumentIndexItem(
                docId=doc.id,
                blobPath=doc.blob_path,
                containerName=doc.container_name,
                domainTag=doc.domain_tag,
                lifecycleStage=doc.lifecycle_stage,
                detectedDocType=classification.doc_type if classification else doc.detected_doc_type,
                resolvedAuthority=profile.resolved_authority if profile else None,
                shareability=doc.shareability,
                auditReady=bool(classification and profile and anchors_count.get(doc.id, 0) > 0),
                lastIngestedAt=doc.last_ingested_at,
            )
        )

    as_of, data_latency, data_quality = _envelope_from_rows(docs)
    return DocumentIndexResponse(asOf=as_of, dataLatency=data_latency, dataQuality=data_quality, items=items)


@router.get("/documents/{doc_id}", response_model=DocumentDetailResponse)
def get_document_detail(
    doc_id: uuid.UUID,
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.COMPLIANCE, Role.GP, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> DocumentDetailResponse:
    doc = db.execute(
        select(DocumentRegistry).where(DocumentRegistry.fund_id == fund_id, DocumentRegistry.id == doc_id)
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    classification = db.execute(
        select(DocumentClassification).where(DocumentClassification.fund_id == fund_id, DocumentClassification.doc_id == doc_id)
    ).scalar_one_or_none()
    governance_profile = db.execute(
        select(DocumentGovernanceProfile).where(DocumentGovernanceProfile.fund_id == fund_id, DocumentGovernanceProfile.doc_id == doc_id)
    ).scalar_one_or_none()
    anchors = list(
        db.execute(
            select(KnowledgeAnchor)
            .where(KnowledgeAnchor.fund_id == fund_id, KnowledgeAnchor.doc_id == doc_id)
            .order_by(KnowledgeAnchor.anchor_type.asc())
        ).scalars().all()
    )

    anchor_out = [
        KnowledgeAnchorOut(
            anchorType=anchor.anchor_type,
            anchorValue=anchor.anchor_value,
            sourceSnippet=anchor.source_snippet,
            pageReference=anchor.page_reference,
        )
        for anchor in anchors
    ]

    return DocumentDetailResponse(
        asOf=doc.as_of,
        dataLatency=doc.data_latency,
        dataQuality=doc.data_quality,
        docId=doc.id,
        blobPath=doc.blob_path,
        containerName=doc.container_name,
        domainTag=doc.domain_tag,
        lifecycleStage=doc.lifecycle_stage,
        classification={
            "docType": classification.doc_type if classification else None,
            "confidenceScore": classification.confidence_score if classification else None,
            "classificationBasis": classification.classification_basis if classification else None,
        },
        governanceProfile={
            "resolvedAuthority": governance_profile.resolved_authority,
            "bindingScope": governance_profile.binding_scope,
            "shareabilityFinal": governance_profile.shareability_final,
            "jurisdiction": governance_profile.jurisdiction,
        }
        if governance_profile
        else None,
        anchors=anchor_out,
    )


@router.post("/pipeline/ingest", response_model=PipelineIngestResponse)
def ingest_pipeline_intelligence(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM])),
) -> PipelineIngestResponse:
    result = run_pipeline_ingest(db, fund_id=fund_id, actor_id=actor.actor_id)
    as_of = dt.datetime.fromisoformat(str(result["asOf"]))
    return PipelineIngestResponse(
        asOf=as_of,
        deals=int(result["deals"]),
        dealDocuments=int(result["dealDocuments"]),
        profiles=int(result["profiles"]),
        briefs=int(result["briefs"]),
        alerts=int(result["alerts"]),
    )


@router.get("/pipeline/deals", response_model=PipelineDealsResponse)
def list_pipeline_deals(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> PipelineDealsResponse:
    deals = list(
        db.execute(
            select(Deal)
            .where(Deal.fund_id == fund_id, Deal.deal_folder_path.is_not(None))
            .order_by(Deal.last_updated_at.desc().nullslast(), Deal.updated_at.desc())
        ).scalars().all()
    )
    profiles = list(db.execute(select(DealIntelligenceProfile).where(DealIntelligenceProfile.fund_id == fund_id)).scalars().all())
    by_deal = {profile.deal_id: profile for profile in profiles}

    items: list[PipelineDealItem] = []
    for deal in deals:
        profile = by_deal.get(deal.id)
        items.append(
            PipelineDealItem(
                dealId=deal.id,
                dealName=deal.deal_name or deal.title,
                sponsorName=deal.sponsor_name,
                lifecycleStage=deal.lifecycle_stage or deal.stage or "SCREENING",
                riskBand=profile.risk_band if profile else None,
                asOf=profile.last_ai_refresh if profile else (deal.last_updated_at or deal.updated_at),
            )
        )

    as_of = max((item.asOf for item in items), default=_utcnow())
    return PipelineDealsResponse(asOf=as_of, dataLatency=None, dataQuality="OK", items=items)


@router.get("/pipeline/deals/{deal_id}", response_model=PipelineDealDetailResponse)
def get_pipeline_deal_detail(
    deal_id: uuid.UUID,
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> PipelineDealDetailResponse:
    deal = db.execute(
        select(Deal).where(Deal.fund_id == fund_id, Deal.id == deal_id, Deal.deal_folder_path.is_not(None))
    ).scalar_one_or_none()
    if deal is None:
        raise HTTPException(status_code=404, detail="Pipeline deal not found")

    profile = db.execute(
        select(DealIntelligenceProfile).where(DealIntelligenceProfile.fund_id == fund_id, DealIntelligenceProfile.deal_id == deal_id)
    ).scalar_one_or_none()
    risk_flags = list(
        db.execute(
            select(DealRiskFlag)
            .where(DealRiskFlag.fund_id == fund_id, DealRiskFlag.deal_id == deal_id)
            .order_by(DealRiskFlag.created_at.desc())
        ).scalars().all()
    )
    brief = db.execute(select(DealICBrief).where(DealICBrief.fund_id == fund_id, DealICBrief.deal_id == deal_id)).scalar_one_or_none()

    risk_out = [
        PipelineRiskFlagOut(
            riskType=flag.risk_type,
            severity=flag.severity,
            reasoning=flag.reasoning,
            sourceDocument=flag.source_document,
        )
        for flag in risk_flags
    ]

    brief_out = (
        PipelineICBriefOut(
            executiveSummary=brief.executive_summary,
            opportunityOverview=brief.opportunity_overview,
            returnProfile=brief.return_profile,
            downsideCase=brief.downside_case,
            riskSummary=brief.risk_summary,
            comparisonPeerFunds=brief.comparison_peer_funds,
            recommendationSignal=brief.recommendation_signal,
        )
        if brief
        else None
    )

    return PipelineDealDetailResponse(
        asOf=profile.last_ai_refresh if profile else (deal.last_updated_at or deal.updated_at),
        dataLatency=None,
        dataQuality="OK",
        dealId=deal.id,
        dealName=deal.deal_name or deal.title,
        sponsorName=deal.sponsor_name,
        lifecycleStage=deal.lifecycle_stage or deal.stage or "SCREENING",
        profile={
            "strategyType": profile.strategy_type,
            "geography": profile.geography,
            "sectorFocus": profile.sector_focus,
            "targetReturn": profile.target_return,
            "riskBand": profile.risk_band,
            "liquidityProfile": profile.liquidity_profile,
            "capitalStructureType": profile.capital_structure_type,
            "keyRisks": profile.key_risks,
            "differentiators": profile.differentiators,
            "summaryIcReady": profile.summary_ic_ready,
            "lastAiRefresh": profile.last_ai_refresh,
        }
        if profile
        else None,
        riskFlags=risk_out,
        icBrief=brief_out,
    )


@router.get("/pipeline/alerts", response_model=PipelineAlertsResponse)
def get_pipeline_alerts(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> PipelineAlertsResponse:
    rows = list(
        db.execute(
            select(PipelineAlert)
            .where(PipelineAlert.fund_id == fund_id)
            .order_by(PipelineAlert.created_at.desc())
            .limit(300)
        ).scalars().all()
    )

    items = [
        PipelineAlertOut(
            alertId=row.id,
            dealId=row.deal_id,
            alertType=row.alert_type,
            severity=row.severity,
            description=row.description,
            createdAt=row.created_at,
            resolvedFlag=row.resolved_flag,
        )
        for row in rows
    ]

    as_of = max((item.createdAt for item in items), default=_utcnow())
    return PipelineAlertsResponse(asOf=as_of, dataLatency=None, dataQuality="OK", items=items)


@router.post("/portfolio/ingest", response_model=PortfolioIngestResponse)
def ingest_portfolio_intelligence(
    fund_id: uuid.UUID,
    as_of: dt.datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM])),
) -> PortfolioIngestResponse:
    result = run_portfolio_ingest(db, fund_id=fund_id, actor_id=actor.actor_id, as_of=as_of)
    payload_as_of = dt.datetime.fromisoformat(str(result["asOf"]))
    return PortfolioIngestResponse(
        asOf=payload_as_of,
        investments=int(result["investments"]),
        metrics=int(result["metrics"]),
        drifts=int(result["drifts"]),
        covenants=int(result["covenants"]),
        cashFlags=int(result["cashFlags"]),
        riskRegistry=int(result["riskRegistry"]),
        briefs=int(result["briefs"]),
    )


@router.get("/portfolio/investments", response_model=PortfolioInvestmentsResponse)
def list_portfolio_investments(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> PortfolioInvestmentsResponse:
    investments = list(
        db.execute(
            select(ActiveInvestment)
            .where(ActiveInvestment.fund_id == fund_id)
            .order_by(ActiveInvestment.last_monitoring_at.desc().nullslast(), ActiveInvestment.updated_at.desc())
        ).scalars().all()
    )
    risks = list(
        db.execute(
            select(InvestmentRiskRegistry).where(
                InvestmentRiskRegistry.fund_id == fund_id,
                InvestmentRiskRegistry.risk_type == "OVERALL",
            )
        ).scalars().all()
    )
    risk_by_investment = {row.investment_id: row for row in risks}

    items = [
        PortfolioInvestmentItem(
            investmentId=row.id,
            investmentName=row.investment_name,
            managerName=row.manager_name,
            lifecycleStatus=row.lifecycle_status,
            strategyType=row.strategy_type,
            targetReturn=row.target_return,
            committedCapitalUsd=float(row.committed_capital_usd) if row.committed_capital_usd is not None else None,
            deployedCapitalUsd=float(row.deployed_capital_usd) if row.deployed_capital_usd is not None else None,
            currentNavUsd=float(row.current_nav_usd) if row.current_nav_usd is not None else None,
            overallRiskLevel=risk_by_investment.get(row.id).risk_level if risk_by_investment.get(row.id) else None,
            asOf=row.as_of,
        )
        for row in investments
    ]

    as_of = max((item.asOf for item in items), default=_utcnow())
    return PortfolioInvestmentsResponse(asOf=as_of, dataLatency=None, dataQuality="OK", items=items)


@router.get("/portfolio/investments/{investment_id}", response_model=PortfolioInvestmentDetailResponse)
def get_portfolio_investment_detail(
    investment_id: uuid.UUID,
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> PortfolioInvestmentDetailResponse:
    investment = db.execute(
        select(ActiveInvestment).where(ActiveInvestment.fund_id == fund_id, ActiveInvestment.id == investment_id)
    ).scalar_one_or_none()
    if investment is None:
        raise HTTPException(status_code=404, detail="Active investment not found")

    drifts = list(
        db.execute(
            select(PerformanceDriftFlag)
            .where(PerformanceDriftFlag.fund_id == fund_id, PerformanceDriftFlag.investment_id == investment_id)
            .order_by(PerformanceDriftFlag.created_at.desc())
        ).scalars().all()
    )
    covenants = list(
        db.execute(
            select(CovenantStatusRegister)
            .where(CovenantStatusRegister.fund_id == fund_id, CovenantStatusRegister.investment_id == investment_id)
            .order_by(CovenantStatusRegister.created_at.desc())
        ).scalars().all()
    )
    cash_impacts = list(
        db.execute(
            select(CashImpactFlag)
            .where(CashImpactFlag.fund_id == fund_id, CashImpactFlag.investment_id == investment_id)
            .order_by(CashImpactFlag.created_at.desc())
        ).scalars().all()
    )
    risks = list(
        db.execute(
            select(InvestmentRiskRegistry)
            .where(InvestmentRiskRegistry.fund_id == fund_id, InvestmentRiskRegistry.investment_id == investment_id)
            .order_by(InvestmentRiskRegistry.created_at.desc())
        ).scalars().all()
    )
    brief = db.execute(
        select(BoardMonitoringBrief).where(BoardMonitoringBrief.fund_id == fund_id, BoardMonitoringBrief.investment_id == investment_id)
    ).scalar_one_or_none()

    drift_out = [
        PortfolioDriftOut(
            metricName=row.metric_name,
            baselineValue=float(row.baseline_value) if row.baseline_value is not None else None,
            currentValue=float(row.current_value) if row.current_value is not None else None,
            driftPct=float(row.drift_pct) if row.drift_pct is not None else None,
            severity=row.severity,
            reasoning=row.reasoning,
        )
        for row in drifts
    ]
    covenant_out = [
        PortfolioCovenantOut(
            covenantName=row.covenant_name,
            status=row.status,
            severity=row.severity,
            details=row.details,
            lastTestedAt=row.last_tested_at,
            nextTestDueAt=row.next_test_due_at,
        )
        for row in covenants
    ]
    cash_out = [
        PortfolioCashImpactOut(
            impactType=row.impact_type,
            severity=row.severity,
            estimatedImpactUsd=float(row.estimated_impact_usd) if row.estimated_impact_usd is not None else None,
            liquidityDays=row.liquidity_days,
            message=row.message,
            resolvedFlag=row.resolved_flag,
        )
        for row in cash_impacts
    ]
    risk_out = [
        PortfolioRiskOut(
            riskType=row.risk_type,
            riskLevel=row.risk_level,
            trend=row.trend,
            rationale=row.rationale,
        )
        for row in risks
    ]
    brief_out = (
        PortfolioBriefOut(
            executiveSummary=brief.executive_summary,
            performanceView=brief.performance_view,
            covenantView=brief.covenant_view,
            liquidityView=brief.liquidity_view,
            riskReclassificationView=brief.risk_reclassification_view,
            recommendedActions=brief.recommended_actions or [],
            lastGeneratedAt=brief.last_generated_at,
        )
        if brief
        else None
    )

    as_of = max(
        [
            investment.as_of,
            *[row.as_of for row in drifts],
            *[row.as_of for row in covenants],
            *[row.as_of for row in cash_impacts],
            *[row.as_of for row in risks],
            brief.as_of if brief else investment.as_of,
        ]
    )

    return PortfolioInvestmentDetailResponse(
        asOf=as_of,
        dataLatency=investment.data_latency,
        dataQuality=investment.data_quality,
        investmentId=investment.id,
        investmentName=investment.investment_name,
        managerName=investment.manager_name,
        lifecycleStatus=investment.lifecycle_status,
        sourceContainer=investment.source_container,
        sourceFolder=investment.source_folder,
        profile={
            "strategyType": investment.strategy_type,
            "targetReturn": investment.target_return,
            "committedCapitalUsd": float(investment.committed_capital_usd) if investment.committed_capital_usd is not None else None,
            "deployedCapitalUsd": float(investment.deployed_capital_usd) if investment.deployed_capital_usd is not None else None,
            "currentNavUsd": float(investment.current_nav_usd) if investment.current_nav_usd is not None else None,
            "lastMonitoringAt": investment.last_monitoring_at,
            "transitionLog": investment.transition_log or [],
        },
        drifts=drift_out,
        covenants=covenant_out,
        cashImpacts=cash_out,
        risks=risk_out,
        boardBrief=brief_out,
    )


@router.get("/portfolio/alerts", response_model=PortfolioAlertsResponse)
def list_portfolio_alerts(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    _role_guard: Actor = Depends(require_roles([Role.ADMIN, Role.GP, Role.COMPLIANCE, Role.INVESTMENT_TEAM, Role.AUDITOR])),
) -> PortfolioAlertsResponse:
    investments = list(db.execute(select(ActiveInvestment).where(ActiveInvestment.fund_id == fund_id)).scalars().all())
    by_id = {row.id: row for row in investments}

    drift_rows = list(
        db.execute(
            select(PerformanceDriftFlag)
            .where(PerformanceDriftFlag.fund_id == fund_id, PerformanceDriftFlag.status == "OPEN")
            .order_by(PerformanceDriftFlag.created_at.desc())
            .limit(200)
        ).scalars().all()
    )
    covenant_rows = list(
        db.execute(
            select(CovenantStatusRegister)
            .where(CovenantStatusRegister.fund_id == fund_id, CovenantStatusRegister.status.in_(["BREACH", "WARNING", "NOT_TESTED", "NOT_CONFIGURED"]))
            .order_by(CovenantStatusRegister.created_at.desc())
            .limit(200)
        ).scalars().all()
    )
    cash_rows = list(
        db.execute(
            select(CashImpactFlag)
            .where(CashImpactFlag.fund_id == fund_id, CashImpactFlag.resolved_flag.is_(False))
            .order_by(CashImpactFlag.created_at.desc())
            .limit(200)
        ).scalars().all()
    )
    risk_rows = list(
        db.execute(
            select(InvestmentRiskRegistry)
            .where(InvestmentRiskRegistry.fund_id == fund_id, InvestmentRiskRegistry.risk_type == "OVERALL", InvestmentRiskRegistry.risk_level.in_(["HIGH", "MEDIUM"]))
            .order_by(InvestmentRiskRegistry.created_at.desc())
            .limit(200)
        ).scalars().all()
    )

    items: list[PortfolioAlertOut] = []
    for row in drift_rows:
        inv = by_id.get(row.investment_id)
        if inv is None:
            continue
        items.append(
            PortfolioAlertOut(
                alertType="PERFORMANCE_DRIFT",
                severity=row.severity,
                investmentId=inv.id,
                investmentName=inv.investment_name,
                message=row.reasoning,
                createdAt=row.created_at,
            )
        )
    for row in covenant_rows:
        inv = by_id.get(row.investment_id)
        if inv is None:
            continue
        items.append(
            PortfolioAlertOut(
                alertType="COVENANT_SURVEILLANCE",
                severity=row.severity,
                investmentId=inv.id,
                investmentName=inv.investment_name,
                message=row.details or f"Covenant status {row.status} for {row.covenant_name}.",
                createdAt=row.created_at,
            )
        )
    for row in cash_rows:
        inv = by_id.get(row.investment_id)
        if inv is None:
            continue
        items.append(
            PortfolioAlertOut(
                alertType="CASH_IMPACT",
                severity=row.severity,
                investmentId=inv.id,
                investmentName=inv.investment_name,
                message=row.message,
                createdAt=row.created_at,
            )
        )
    for row in risk_rows:
        inv = by_id.get(row.investment_id)
        if inv is None:
            continue
        items.append(
            PortfolioAlertOut(
                alertType="RISK_RECLASSIFICATION",
                severity=row.risk_level,
                investmentId=inv.id,
                investmentName=inv.investment_name,
                message=row.rationale,
                createdAt=row.created_at,
            )
        )

    items.sort(key=lambda i: i.createdAt, reverse=True)
    items = items[:300]

    as_of = max((item.createdAt for item in items), default=_utcnow())
    return PortfolioAlertsResponse(asOf=as_of, dataLatency=None, dataQuality="OK", items=items)

