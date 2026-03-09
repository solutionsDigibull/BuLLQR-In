"""Add product_stages association table.

Revision ID: a1b2c3d4e5f6
Revises: 4cd7f6409ef4
Create Date: 2026-03-02 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "a1b2c3d4e5f6"
down_revision = "4cd7f6409ef4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_stages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "stage_id",
            UUID(as_uuid=True),
            sa.ForeignKey("production_stages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("product_id", "stage_id", name="uq_product_stage"),
    )
    op.create_index("ix_product_stages_product_id", "product_stages", ["product_id"])
    op.create_index("ix_product_stages_stage_id", "product_stages", ["stage_id"])


def downgrade() -> None:
    op.drop_index("ix_product_stages_stage_id", table_name="product_stages")
    op.drop_index("ix_product_stages_product_id", table_name="product_stages")
    op.drop_table("product_stages")
