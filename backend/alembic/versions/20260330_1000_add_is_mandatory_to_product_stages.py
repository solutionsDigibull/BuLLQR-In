"""Add is_mandatory column to product_stages.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-30 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_stages",
        sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("product_stages", "is_mandatory")
