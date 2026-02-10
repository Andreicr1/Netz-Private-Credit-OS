import sqlalchemy as sa
from alembic import op

revision = "0015_ai_answers_audit"
down_revision = "0014_document_ingestion_status"


def upgrade():
    op.create_table(
        "ai_questions",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("actor_id", sa.String(length=200), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("root_folder", sa.String(length=200), nullable=True),
        sa.Column("top_k", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("request_id", sa.String(length=64), nullable=False),
        sa.Column("retrieved_chunk_ids", sa.JSON(), nullable=True),
        sa.Column("created_at_utc", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_ai_questions_fund_id", "ai_questions", ["fund_id"])
    op.create_index("ix_ai_questions_access_level", "ai_questions", ["access_level"])
    op.create_index("ix_ai_questions_actor_id", "ai_questions", ["actor_id"])
    op.create_index("ix_ai_questions_root_folder", "ai_questions", ["root_folder"])
    op.create_index("ix_ai_questions_request_id", "ai_questions", ["request_id"])
    op.create_index("ix_ai_questions_created_at_utc", "ai_questions", ["created_at_utc"])

    op.create_table(
        "ai_answers",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("question_id", sa.Uuid(), sa.ForeignKey("ai_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_version", sa.String(length=80), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("prompt", sa.JSON(), nullable=False),
        sa.Column("created_at_utc", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_ai_answers_fund_id", "ai_answers", ["fund_id"])
    op.create_index("ix_ai_answers_access_level", "ai_answers", ["access_level"])
    op.create_index("ix_ai_answers_question_id", "ai_answers", ["question_id"])
    op.create_index("ix_ai_answers_model_version", "ai_answers", ["model_version"])
    op.create_index("ix_ai_answers_created_at_utc", "ai_answers", ["created_at_utc"])
    op.create_index("ix_ai_answers_fund_question", "ai_answers", ["fund_id", "question_id"])

    op.create_table(
        "ai_answer_citations",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("answer_id", sa.Uuid(), sa.ForeignKey("ai_answers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_id", sa.Uuid(), sa.ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_id", sa.Uuid(), sa.ForeignKey("document_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_start", sa.Integer(), nullable=True),
        sa.Column("page_end", sa.Integer(), nullable=True),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("source_blob", sa.String(length=800), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_ai_answer_citations_fund_id", "ai_answer_citations", ["fund_id"])
    op.create_index("ix_ai_answer_citations_access_level", "ai_answer_citations", ["access_level"])
    op.create_index("ix_ai_answer_citations_answer_id", "ai_answer_citations", ["answer_id"])
    op.create_index("ix_ai_answer_citations_chunk_id", "ai_answer_citations", ["chunk_id"])
    op.create_index("ix_ai_answer_citations_document_id", "ai_answer_citations", ["document_id"])
    op.create_index("ix_ai_answer_citations_version_id", "ai_answer_citations", ["version_id"])
    op.create_index("ix_ai_answer_citations_fund_answer", "ai_answer_citations", ["fund_id", "answer_id"])


def downgrade():
    op.drop_index("ix_ai_answer_citations_fund_answer", table_name="ai_answer_citations")
    op.drop_index("ix_ai_answer_citations_version_id", table_name="ai_answer_citations")
    op.drop_index("ix_ai_answer_citations_document_id", table_name="ai_answer_citations")
    op.drop_index("ix_ai_answer_citations_chunk_id", table_name="ai_answer_citations")
    op.drop_index("ix_ai_answer_citations_answer_id", table_name="ai_answer_citations")
    op.drop_index("ix_ai_answer_citations_access_level", table_name="ai_answer_citations")
    op.drop_index("ix_ai_answer_citations_fund_id", table_name="ai_answer_citations")
    op.drop_table("ai_answer_citations")

    op.drop_index("ix_ai_answers_fund_question", table_name="ai_answers")
    op.drop_index("ix_ai_answers_created_at_utc", table_name="ai_answers")
    op.drop_index("ix_ai_answers_model_version", table_name="ai_answers")
    op.drop_index("ix_ai_answers_question_id", table_name="ai_answers")
    op.drop_index("ix_ai_answers_access_level", table_name="ai_answers")
    op.drop_index("ix_ai_answers_fund_id", table_name="ai_answers")
    op.drop_table("ai_answers")

    op.drop_index("ix_ai_questions_created_at_utc", table_name="ai_questions")
    op.drop_index("ix_ai_questions_request_id", table_name="ai_questions")
    op.drop_index("ix_ai_questions_root_folder", table_name="ai_questions")
    op.drop_index("ix_ai_questions_actor_id", table_name="ai_questions")
    op.drop_index("ix_ai_questions_access_level", table_name="ai_questions")
    op.drop_index("ix_ai_questions_fund_id", table_name="ai_questions")
    op.drop_table("ai_questions")

