"""Add stage_sop_files table for SOP file attachments.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-30 11:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stage_sop_files",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "stage_id",
            UUID(as_uuid=True),
            sa.ForeignKey("production_stages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_stage_sop_files_stage_id", "stage_sop_files", ["stage_id"])


def downgrade() -> None:
    op.drop_index("ix_stage_sop_files_stage_id", table_name="stage_sop_files")
    op.drop_table("stage_sop_files")
