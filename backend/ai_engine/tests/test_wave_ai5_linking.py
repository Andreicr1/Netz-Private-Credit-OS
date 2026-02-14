from __future__ import annotations

import datetime as dt
import os
import sys
import uuid

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ai_engine.linker import run_cross_container_linking
from app.core.db.base import Base
from app.core.db.models import Fund
from app.modules.ai.models import KnowledgeLink, ObligationEvidenceMap, ObligationRegister, DocumentRegistry
from app.modules.documents.models import Document, DocumentVersion

# Ensure metadata registration
from app.core.db import models as _core_models  # noqa: F401
from app.modules.ai import models as _ai_models  # noqa: F401
from app.modules.documents import models as _documents_models  # noqa: F401
from app.modules.deals import models as _deals_models  # noqa: F401


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _seed_document(db: Session, *, fund_id: uuid.UUID, container: str, title: str, authority: str, document_id: uuid.UUID | None = None) -> DocumentRegistry:
    doc_id = document_id or uuid.uuid4()
    version_id = uuid.uuid4()

    db.add(
        Document(
            id=doc_id,
            fund_id=fund_id,
            access_level="internal",
            source="dataroom",
            document_type="DATAROOM",
            title=title,
            status="uploaded",
            current_version=1,
            root_folder=container,
            folder_path=container,
            created_by="t",
            updated_by="t",
        )
    )
    db.add(
        DocumentVersion(
            id=version_id,
            fund_id=fund_id,
            access_level="internal",
            document_id=doc_id,
            version_number=1,
            blob_uri=f"https://example.blob/{container}/{title}",
            blob_path=f"{container}/{title}",
            checksum="a" * 64,
            file_size_bytes=10,
            is_final=False,
            ingest_status="INDEXED",
            ingestion_status="INDEXED",
            created_by="t",
            updated_by="t",
        )
    )

    row = DocumentRegistry(
        fund_id=fund_id,
        access_level="internal",
        document_id=doc_id,
        version_id=version_id,
        blob_path=f"{container}/{title}",
        container_name=container,
        domain_tag="TEST",
        authority=authority,
        shareability="INTERNAL",
        detected_doc_type="OTHER",
        lifecycle_stage="ACTIVE",
        last_ingested_at=_now(),
        checksum="x",
        etag="y",
        last_modified_utc=_now(),
        root_folder=container,
        folder_path=f"{container}/{title}",
        title=title,
        institutional_type="OPERATIONAL_EVIDENCE",
        source_signals={"seed": True},
        classifier_version="test",
        as_of=_now(),
        data_latency=None,
        data_quality="OK",
        created_by="t",
        updated_by="t",
    )
    db.add(row)
    db.flush()
    return row


def test_wave_ai5_cross_container_linking_governance_rules():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)

    db = TestingSessionLocal()
    try:
        fund_id = uuid.uuid4()
        db.add(Fund(id=fund_id, name="Wave AI5 Fund"))
        db.flush()

        narrative_doc = _seed_document(
            db,
            fund_id=fund_id,
            container="dataroom-investor-facing",
            title="Investor Deck Submit Quarterly Report.pdf",
            authority="NARRATIVE",
        )
        binding_doc_a = _seed_document(
            db,
            fund_id=fund_id,
            container="fund-constitution-governance",
            title="Fund Constitution Quarterly Reporting.pdf",
            authority="BINDING",
        )
        binding_doc_b = _seed_document(
            db,
            fund_id=fund_id,
            container="regulatory-library-cima",
            title="CIMA Rulebook Quarterly Reporting.pdf",
            authority="BINDING",
        )
        intelligence_doc = _seed_document(
            db,
            fund_id=fund_id,
            container="investment-pipeline-intelligence",
            title="Deal Alpha - Submit Quarterly Report Memo.pdf",
            authority="INTELLIGENCE",
        )
        _seed_document(
            db,
            fund_id=fund_id,
            container="portfolio-monitoring-evidence",
            title="Submit Quarterly Report Evidence Package.pdf",
            authority="EVIDENCE",
        )

        shared_obligation_text = "Manager shall submit quarterly report to administrator"

        db.add(
            ObligationRegister(
                fund_id=fund_id,
                access_level="internal",
                obligation_id="OB-TEST-001",
                source="CIMA",
                obligation_text=shared_obligation_text,
                frequency="Quarterly",
                due_rule="within 30 days after quarter end",
                responsible_party="Investment Manager",
                evidence_expected="Quarterly report filing",
                status="MissingEvidence",
                source_documents=[{"documentId": str(binding_doc_a.document_id)}],
                as_of=_now(),
                data_latency=None,
                data_quality="OK",
                created_by="t",
                updated_by="t",
            )
        )
        db.add(
            ObligationRegister(
                fund_id=fund_id,
                access_level="internal",
                obligation_id="OB-TEST-002",
                source="CIMA",
                obligation_text=shared_obligation_text,
                frequency="Quarterly",
                due_rule="within 45 days after quarter end",
                responsible_party="Investment Manager",
                evidence_expected="Quarterly report filing",
                status="MissingEvidence",
                source_documents=[{"documentId": str(binding_doc_b.document_id)}],
                as_of=_now(),
                data_latency=None,
                data_quality="OK",
                created_by="t",
                updated_by="t",
            )
        )
        db.commit()

        result = run_cross_container_linking(db, fund_id=fund_id, actor_id="wave-ai5-test", as_of=_now())

        assert result["mode"] == "CROSS_CONTAINER_LINKING"
        assert result["status"] in {"PASS", "PARTIAL"}

        links = list(db.execute(select(KnowledgeLink).where(KnowledgeLink.fund_id == fund_id)).scalars().all())
        assert len(links) > 0  # Links persist in DB

        # Narrative docs must never derive obligations
        assert not any(link.source_document_id == narrative_doc.id and link.link_type == "DERIVES_OBLIGATION" for link in links)

        # Evidence docs can satisfy obligations
        assert any(link.link_type == "SATISFIES" for link in links)

        # Pipeline intelligence docs can reference obligations (no authority inversion)
        assert any(link.source_document_id == intelligence_doc.id and link.link_type == "REFERENCES" for link in links)

        # Binding conflict must emit CONFLICTS_WITH
        assert any(link.link_type == "CONFLICTS_WITH" for link in links)

        obligation_map = list(db.execute(select(ObligationEvidenceMap).where(ObligationEvidenceMap.fund_id == fund_id)).scalars().all())
        assert len(obligation_map) >= 2
        assert any(row.satisfaction_status in {"MATCHED", "PARTIAL"} for row in obligation_map)
    finally:
        db.close()
