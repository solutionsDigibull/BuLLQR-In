"""Normalize existing work_orders.work_order_code values.

Aligns legacy rows with the canonicalization rules now applied at every read
and write site (see ``backend/src/utils/barcode.py``). Required because today's
Coolify deploy added stronger normalization on the frontend / new scans, which
means lookups against legacy rows (stored without that normalization) miss and
falsely report stage-1 as incomplete.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-30 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

from src.utils.barcode import normalize_barcode


# revision identifiers
revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, work_order_code FROM work_orders")
    ).fetchall()

    updates: dict = {}              # id -> canonical
    canonical_to_ids: dict = {}     # canonical -> [ids]
    for row in rows:
        canonical = normalize_barcode(row.work_order_code)
        canonical_to_ids.setdefault(canonical, []).append(row.id)
        if canonical != row.work_order_code:
            updates[row.id] = canonical

    collisions = {c: ids for c, ids in canonical_to_ids.items() if len(ids) > 1}
    if collisions:
        sample = "; ".join(
            f"{c!r} -> {ids}" for c, ids in list(collisions.items())[:5]
        )
        raise RuntimeError(
            "Cannot normalize work_orders.work_order_code: "
            f"{len(collisions)} duplicate work order(s) after normalization. "
            "Resolve manually (merge or delete the older rows) before "
            f"re-running this migration. Examples: {sample}"
        )

    for wid, new_code in updates.items():
        conn.execute(
            sa.text(
                "UPDATE work_orders SET work_order_code = :c WHERE id = :id"
            ),
            {"c": new_code, "id": wid},
        )


def downgrade() -> None:
    # Normalization is one-way (information is lost). No-op.
    pass
