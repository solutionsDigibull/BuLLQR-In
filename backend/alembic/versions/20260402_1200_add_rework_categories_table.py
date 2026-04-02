"""Add rework_categories table and category_id FK to rework_configs.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-02 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create rework_categories table
    op.create_table(
        "rework_categories",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_rework_categories_name"),
        "rework_categories",
        ["name"],
        unique=True,
    )

    # 2. Add category_id column to rework_configs
    op.add_column(
        "rework_configs",
        sa.Column("category_id", UUID(as_uuid=True), nullable=True),
    )

    # 3. Add FK constraint
    op.create_foreign_key(
        "fk_rework_configs_category_id",
        "rework_configs",
        "rework_categories",
        ["category_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 4. Drop old unique index on rework_detail
    op.drop_index(
        op.f("ix_rework_configs_rework_detail"),
        table_name="rework_configs",
    )

    # 5. Re-create rework_detail as a non-unique index
    op.create_index(
        op.f("ix_rework_configs_rework_detail"),
        "rework_configs",
        ["rework_detail"],
        unique=False,
    )

    # 6. Create composite unique constraint (category_id, rework_detail)
    op.create_unique_constraint(
        "uq_category_rework_detail",
        "rework_configs",
        ["category_id", "rework_detail"],
    )

    # 7. Index on category_id
    op.create_index(
        op.f("ix_rework_configs_category_id"),
        "rework_configs",
        ["category_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_rework_configs_category_id"), table_name="rework_configs")
    op.drop_constraint("uq_category_rework_detail", "rework_configs", type_="unique")
    op.drop_index(op.f("ix_rework_configs_rework_detail"), table_name="rework_configs")
    op.create_index(
        op.f("ix_rework_configs_rework_detail"),
        "rework_configs",
        ["rework_detail"],
        unique=True,
    )
    op.drop_constraint("fk_rework_configs_category_id", "rework_configs", type_="foreignkey")
    op.drop_column("rework_configs", "category_id")
    op.drop_index(op.f("ix_rework_categories_name"), table_name="rework_categories")
    op.drop_table("rework_categories")
