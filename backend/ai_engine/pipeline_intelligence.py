from __future__ import annotations

import datetime as dt
import re
import uuid
from collections import defaultdict

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.ai.models import DealDocumentIntelligence, DealICBrief, DealIntelligenceProfile, DealRiskFlag, DocumentRegistry, KnowledgeAnchor, PipelineAlert
from app.modules.deals.models import Deal


PIPELINE_CONTAINER = "investment-pipeline-intelligence"

RISK_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}
RISK_BAND_ORDER = {"LOW": 1, "MODERATE": 2, "HIGH": 3, "SPECULATIVE": 4}

DOC_TYPE_MAP: dict[str, tuple[str, int]] = {
    "INVESTMENT_MEMO": ("Investment Memo", 92),
    "DEAL_MARKETING": ("Marketing Deck", 82),
    "FUND_CONSTITUTIONAL": ("Legal Draft", 76),
    "SERVICE_PROVIDER_CONTRACT": ("Legal Draft", 84),
    "AUDIT_EVIDENCE": ("Due Diligence Report", 80),
    "REGULATORY_CIMA": ("Legal Draft", 70),
    "OTHER": ("Term Sheet", 60),
}


def _now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _folder_from_blob(blob_path: str) -> str | None:
    parts = [p for p in (blob_path or "").split("/") if p]
    if not parts:
        return None
    return parts[0]


def discover_pipeline_deals(db: Session, *, fund_id: uuid.UUID, actor_id: str = "ai-engine") -> list[Deal]:
    now = _now_utc()
    docs = list(
        db.execute(
            select(DocumentRegistry).where(
                DocumentRegistry.fund_id == fund_id,
                DocumentRegistry.container_name == PIPELINE_CONTAINER,
            )
        ).scalars().all()
    )

    grouped: dict[str, list[DocumentRegistry]] = defaultdict(list)
    for doc in docs:
        folder = _folder_from_blob(doc.blob_path)
        if not folder:
            continue
        grouped[folder].append(doc)

    saved: list[Deal] = []
    for folder_name, folder_docs in grouped.items():
        folder_path = f"{PIPELINE_CONTAINER}/{folder_name}"
        existing = db.execute(
            select(Deal).where(
                Deal.fund_id == fund_id,
                Deal.deal_folder_path == folder_path,
            )
        ).scalar_one_or_none()

        first_detected = min((d.last_ingested_at for d in folder_docs), default=now)
        last_updated = max((d.last_ingested_at for d in folder_docs), default=now)

        if existing is None:
            deal = Deal(
                fund_id=fund_id,
                access_level="internal",
                deal_name=folder_name,
                sponsor_name=folder_name,
                lifecycle_stage="SCREENING",
                first_detected_at=first_detected,
                last_updated_at=last_updated,
                deal_folder_path=folder_path,
                transition_target_container="portfolio-active-investments",
                intelligence_history={"authority": "INTELLIGENCE", "sourceContainer": PIPELINE_CONTAINER},
                title=folder_name,
                borrower_name=folder_name,
                stage="SCREENING",
                is_archived=False,
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(deal)
            db.flush()
            saved.append(deal)
            continue

        existing.deal_name = folder_name
        existing.sponsor_name = folder_name
        existing.lifecycle_stage = existing.lifecycle_stage or existing.stage or "SCREENING"
        existing.stage = existing.lifecycle_stage
        existing.last_updated_at = last_updated
        existing.deal_folder_path = folder_path
        existing.transition_target_container = existing.transition_target_container or "portfolio-active-investments"
        existing.intelligence_history = existing.intelligence_history or {"authority": "INTELLIGENCE", "sourceContainer": PIPELINE_CONTAINER}
        existing.updated_by = actor_id
        db.flush()
        saved.append(existing)

    db.commit()
    return saved


def aggregate_deal_documents(db: Session, *, fund_id: uuid.UUID, actor_id: str = "ai-engine") -> list[DealDocumentIntelligence]:
    deals = list(db.execute(select(Deal).where(Deal.fund_id == fund_id, Deal.deal_folder_path.is_not(None))).scalars().all())
    docs = list(
        db.execute(
            select(DocumentRegistry).where(
                DocumentRegistry.fund_id == fund_id,
                DocumentRegistry.container_name == PIPELINE_CONTAINER,
            )
        ).scalars().all()
    )

    saved: list[DealDocumentIntelligence] = []
    for deal in deals:
        folder_name = (deal.deal_name or "").strip().lower()
        matched_docs = [d for d in docs if _folder_from_blob(d.blob_path or "") and _folder_from_blob(d.blob_path or "").lower() == folder_name]

        for doc in matched_docs:
            doc_type, confidence = DOC_TYPE_MAP.get(doc.detected_doc_type or "OTHER", ("Term Sheet", 60))
            existing = db.execute(
                select(DealDocumentIntelligence).where(
                    DealDocumentIntelligence.fund_id == fund_id,
                    DealDocumentIntelligence.deal_id == deal.id,
                    DealDocumentIntelligence.doc_id == doc.id,
                )
            ).scalar_one_or_none()

            payload = {
                "fund_id": fund_id,
                "access_level": "internal",
                "deal_id": deal.id,
                "doc_id": doc.id,
                "doc_type": doc_type,
                "confidence_score": int(confidence),
                "created_by": actor_id,
                "updated_by": actor_id,
            }

            if existing is None:
                row = DealDocumentIntelligence(**payload)
                db.add(row)
                db.flush()
            else:
                for key, value in payload.items():
                    if key == "created_by":
                        continue
                    setattr(existing, key, value)
                db.flush()
                row = existing
            saved.append(row)

    db.commit()
    return saved


def _extract_target_return(anchors: list[KnowledgeAnchor]) -> str | None:
    for anchor in anchors:
        if anchor.anchor_type in {"EFFECTIVE_DATE", "FUND_NAME", "PROVIDER_NAME"}:
            continue
        match = re.search(r"(\d{1,2}(?:\.\d{1,2})?\s?%)", anchor.anchor_value or "")
        if match:
            return match.group(1).replace(" ", "")
    return None


def _strategy_from_docs(doc_types: list[str]) -> str:
    normalized = " ".join(doc_types).lower()
    if "memo" in normalized:
        return "Direct Lending"
    if "marketing" in normalized:
        return "LP Investment"
    if "term sheet" in normalized:
        return "Equity SPV"
    return "GP Stakes"


def _risk_band_from_flags(flags: list[dict]) -> str:
    if not flags:
        return "MODERATE"
    max_sev = max((RISK_ORDER.get(f["severity"], 1) for f in flags), default=1)
    if max_sev <= 1:
        return "LOW"
    if max_sev == 2:
        return "MODERATE"
    high_count = sum(1 for f in flags if f["severity"] == "HIGH")
    return "SPECULATIVE" if high_count >= 2 else "HIGH"


def _infer_risk_flags_for_deal(deal: Deal, anchors: list[KnowledgeAnchor], docs: list[DealDocumentIntelligence]) -> list[dict]:
    flags: list[dict] = []

    for anchor in anchors:
        value = (anchor.anchor_value or "").lower()
        snippet = anchor.source_snippet or anchor.anchor_value or ""
        source_document = anchor.page_reference or None

        if "liquidity" in value:
            flags.append({"risk_type": "LIQUIDITY", "severity": "MEDIUM", "reasoning": f"Liquidity signal detected: {snippet}", "source_document": source_document})
        if "legal" in value or "agreement" in value:
            flags.append({"risk_type": "LEGAL", "severity": "HIGH", "reasoning": f"Legal exposure indicator: {snippet}", "source_document": source_document})
        if "track" in value and "record" in value:
            flags.append({"risk_type": "TRACK_RECORD", "severity": "MEDIUM", "reasoning": f"Track record caveat: {snippet}", "source_document": source_document})
        if "leverage" in value:
            flags.append({"risk_type": "LEVERAGE", "severity": "HIGH", "reasoning": f"Leverage mention requires review: {snippet}", "source_document": source_document})
        if "concentration" in value:
            flags.append({"risk_type": "CONCENTRATION", "severity": "MEDIUM", "reasoning": f"Concentration signal: {snippet}", "source_document": source_document})

    if not flags:
        for doc in docs:
            if "Legal" in doc.doc_type:
                flags.append(
                    {
                        "risk_type": "LEGAL",
                        "severity": "MEDIUM",
                        "reasoning": "Legal draft detected in pipeline; review terms before IC.",
                        "source_document": str(doc.doc_id),
                    }
                )
                break

    return flags[:24]


def build_deal_intelligence_profiles(db: Session, *, fund_id: uuid.UUID, actor_id: str = "ai-engine") -> list[DealIntelligenceProfile]:
    now = _now_utc()
    deals = list(db.execute(select(Deal).where(Deal.fund_id == fund_id, Deal.deal_folder_path.is_not(None))).scalars().all())
    saved: list[DealIntelligenceProfile] = []

    for deal in deals:
        docs = list(
            db.execute(
                select(DealDocumentIntelligence).where(
                    DealDocumentIntelligence.fund_id == fund_id,
                    DealDocumentIntelligence.deal_id == deal.id,
                )
            ).scalars().all()
        )
        doc_ids = [d.doc_id for d in docs]
        anchors = []
        if doc_ids:
            anchors = list(
                db.execute(
                    select(KnowledgeAnchor).where(
                        KnowledgeAnchor.fund_id == fund_id,
                        KnowledgeAnchor.doc_id.in_(doc_ids),
                    )
                ).scalars().all()
            )

        flags = _infer_risk_flags_for_deal(deal, anchors, docs)
        risk_band = _risk_band_from_flags(flags)
        strategy = _strategy_from_docs([d.doc_type for d in docs])
        target_return = _extract_target_return(anchors)

        geography = "Global"
        if any("united states" in (a.anchor_value or "").lower() or "us" == (a.anchor_value or "").lower() for a in anchors):
            geography = "US"
        elif any("europe" in (a.anchor_value or "").lower() for a in anchors):
            geography = "Europe"

        sector = "Private Credit"
        if any("real estate" in (a.anchor_value or "").lower() for a in anchors):
            sector = "Real Estate Credit"

        liquidity = "Medium Liquidity"
        if any(f["risk_type"] == "LIQUIDITY" and f["severity"] == "HIGH" for f in flags):
            liquidity = "Low Liquidity"

        capital_structure = "Senior Secured"
        if any("equity" in (a.anchor_value or "").lower() for a in anchors):
            capital_structure = "Equity"

        key_risks = [{"riskType": f["risk_type"], "severity": f["severity"], "reasoning": f["reasoning"]} for f in flags]
        differentiators = [
            "Institutional pipeline intelligence profile",
            "Deterministic risk pre-analysis",
            "IC-ready summary generated from persisted evidence",
        ]

        summary = (
            f"Deal {deal.deal_name or deal.title} in lifecycle {deal.lifecycle_stage or deal.stage}. "
            f"Strategy {strategy}, geography {geography}, sector {sector}, risk band {risk_band}. "
            f"Target return {target_return or 'not explicitly declared'} based on available deal anchors."
        )

        existing = db.execute(
            select(DealIntelligenceProfile).where(
                DealIntelligenceProfile.fund_id == fund_id,
                DealIntelligenceProfile.deal_id == deal.id,
            )
        ).scalar_one_or_none()

        payload = {
            "fund_id": fund_id,
            "access_level": "internal",
            "deal_id": deal.id,
            "strategy_type": strategy,
            "geography": geography,
            "sector_focus": sector,
            "target_return": target_return,
            "risk_band": risk_band,
            "liquidity_profile": liquidity,
            "capital_structure_type": capital_structure,
            "key_risks": key_risks,
            "differentiators": differentiators,
            "summary_ic_ready": summary,
            "last_ai_refresh": now,
            "created_by": actor_id,
            "updated_by": actor_id,
        }

        if existing is None:
            row = DealIntelligenceProfile(**payload)
            db.add(row)
            db.flush()
        else:
            for key, value in payload.items():
                if key == "created_by":
                    continue
                setattr(existing, key, value)
            db.flush()
            row = existing

        db.execute(delete(DealRiskFlag).where(DealRiskFlag.fund_id == fund_id, DealRiskFlag.deal_id == deal.id))
        for flag in flags:
            db.add(
                DealRiskFlag(
                    fund_id=fund_id,
                    access_level="internal",
                    deal_id=deal.id,
                    risk_type=flag["risk_type"],
                    severity=flag["severity"],
                    reasoning=flag["reasoning"],
                    source_document=flag.get("source_document"),
                    created_by=actor_id,
                    updated_by=actor_id,
                )
            )

        saved.append(row)

    db.commit()
    return saved


def build_ic_briefs(db: Session, *, fund_id: uuid.UUID, actor_id: str = "ai-engine") -> list[DealICBrief]:
    profiles = list(
        db.execute(select(DealIntelligenceProfile).where(DealIntelligenceProfile.fund_id == fund_id)).scalars().all()
    )
    saved: list[DealICBrief] = []

    for profile in profiles:
        deal = db.execute(select(Deal).where(Deal.id == profile.deal_id, Deal.fund_id == fund_id)).scalar_one()
        flags = list(
            db.execute(
                select(DealRiskFlag).where(DealRiskFlag.fund_id == fund_id, DealRiskFlag.deal_id == deal.id)
            ).scalars().all()
        )

        high_risk = any(flag.severity == "HIGH" for flag in flags)
        recommendation = "CAUTION" if profile.risk_band in {"HIGH", "SPECULATIVE"} or high_risk else "POSITIVE"
        if profile.risk_band == "MODERATE" and not high_risk:
            recommendation = "NEUTRAL"

        brief_payload = {
            "fund_id": fund_id,
            "access_level": "internal",
            "deal_id": deal.id,
            "executive_summary": profile.summary_ic_ready,
            "opportunity_overview": f"{deal.deal_name or deal.title} is currently in {deal.lifecycle_stage or deal.stage} stage.",
            "return_profile": f"Target return: {profile.target_return or 'Not explicitly declared'}; Risk band: {profile.risk_band}.",
            "downside_case": "Downside scenario driven by liquidity, legal, and track-record sensitivity indicators.",
            "risk_summary": "; ".join([f"{r.risk_type}:{r.severity}" for r in flags]) or "No material risks detected.",
            "comparison_peer_funds": "Peer comparison available after standardized scorecard completion.",
            "recommendation_signal": recommendation,
            "created_by": actor_id,
            "updated_by": actor_id,
        }

        existing = db.execute(
            select(DealICBrief).where(
                DealICBrief.fund_id == fund_id,
                DealICBrief.deal_id == deal.id,
            )
        ).scalar_one_or_none()

        if existing is None:
            row = DealICBrief(**brief_payload)
            db.add(row)
            db.flush()
        else:
            for key, value in brief_payload.items():
                if key == "created_by":
                    continue
                setattr(existing, key, value)
            db.flush()
            row = existing

        saved.append(row)

    db.commit()
    return saved


def run_pipeline_monitoring(db: Session, *, fund_id: uuid.UUID, actor_id: str = "ai-engine") -> list[PipelineAlert]:
    now = _now_utc()
    alerts: list[PipelineAlert] = []

    deals = list(db.execute(select(Deal).where(Deal.fund_id == fund_id, Deal.deal_folder_path.is_not(None))).scalars().all())
    for deal in deals:
        profile = db.execute(
            select(DealIntelligenceProfile).where(
                DealIntelligenceProfile.fund_id == fund_id,
                DealIntelligenceProfile.deal_id == deal.id,
            )
        ).scalar_one_or_none()
        flags = list(
            db.execute(select(DealRiskFlag).where(DealRiskFlag.fund_id == fund_id, DealRiskFlag.deal_id == deal.id)).scalars().all()
        )

        new_alerts: list[tuple[str, str, str]] = []
        if profile and profile.risk_band in {"HIGH", "SPECULATIVE"}:
            new_alerts.append(("RISK_BAND_CHANGE", "HIGH", f"Risk band for {deal.deal_name or deal.title} is {profile.risk_band}."))

        legal_high = any(flag.risk_type == "LEGAL" and flag.severity == "HIGH" for flag in flags)
        if legal_high:
            new_alerts.append(("LEGAL_RISK_DETECTED", "HIGH", f"High legal risk detected for {deal.deal_name or deal.title}."))

        if profile and profile.target_return and re.search(r"(\d+(?:\.\d+)?)", profile.target_return):
            value = float(re.search(r"(\d+(?:\.\d+)?)", profile.target_return).group(1))
            if value < 8.0:
                new_alerts.append(("TARGET_RETURN_DROP", "MEDIUM", f"Target return dropped to {profile.target_return} for {deal.deal_name or deal.title}."))

        track_record_flag = any(flag.risk_type == "TRACK_RECORD" and flag.severity in {"MEDIUM", "HIGH"} for flag in flags)
        if track_record_flag:
            new_alerts.append(("TRACK_RECORD_INCONSISTENCY", "MEDIUM", f"Track record inconsistency signal for {deal.deal_name or deal.title}."))

        for alert_type, severity, description in new_alerts:
            existing = db.execute(
                select(PipelineAlert).where(
                    PipelineAlert.fund_id == fund_id,
                    PipelineAlert.deal_id == deal.id,
                    PipelineAlert.alert_type == alert_type,
                    PipelineAlert.resolved_flag.is_(False),
                )
            ).scalar_one_or_none()
            if existing:
                continue
            alert = PipelineAlert(
                fund_id=fund_id,
                access_level="internal",
                deal_id=deal.id,
                alert_type=alert_type,
                severity=severity,
                description=description,
                resolved_flag=False,
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(alert)
            db.flush()
            alerts.append(alert)

    db.commit()
    return alerts


def run_pipeline_ingest(db: Session, *, fund_id: uuid.UUID, actor_id: str = "ai-engine") -> dict[str, int | str]:
    deals = discover_pipeline_deals(db, fund_id=fund_id, actor_id=actor_id)
    deal_docs = aggregate_deal_documents(db, fund_id=fund_id, actor_id=actor_id)
    profiles = build_deal_intelligence_profiles(db, fund_id=fund_id, actor_id=actor_id)
    briefs = build_ic_briefs(db, fund_id=fund_id, actor_id=actor_id)
    alerts = run_pipeline_monitoring(db, fund_id=fund_id, actor_id=actor_id)

    return {
        "asOf": _now_utc().isoformat(),
        "deals": len(deals),
        "dealDocuments": len(deal_docs),
        "profiles": len(profiles),
        "briefs": len(briefs),
        "alerts": len(alerts),
    }
