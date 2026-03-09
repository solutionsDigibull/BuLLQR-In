"""Scan record model for individual scan events."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from src.models.types import GUID
from sqlalchemy.orm import relationship
from src.database import Base


class ScanRecord(Base):
    """
    Individual scan events with quality status and operator information.

    Each scan records:
    - Work order and stage
    - Operator who performed the scan
    - Quality status (ok, not_ok, ok_update, not_ok_update)
    - First article inspection flag and QI approval
    - Scan type (normal, first_article, update)

    The UNIQUE constraint on (work_order_id, stage_id) prevents duplicate normal scans.
    Update scans are allowed as status corrections.
    """

    __tablename__ = "scan_records"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    work_order_id = Column(GUID, ForeignKey('work_orders.id', ondelete='CASCADE'), nullable=False, index=True)
    stage_id = Column(GUID, ForeignKey('production_stages.id', ondelete='CASCADE'), nullable=False, index=True)
    operator_id = Column(GUID, ForeignKey('operators.id', ondelete='SET NULL'), nullable=False, index=True)
    scan_type = Column(String(50), nullable=False)
    quality_status = Column(String(50), nullable=False, index=True)
    is_first_article = Column(Boolean, nullable=False, default=False, index=True)
    supervisor_id = Column(GUID, ForeignKey('operators.id', ondelete='SET NULL'), nullable=True)
    quality_inspector_id = Column(GUID, ForeignKey('operators.id', ondelete='SET NULL'), nullable=True)
    previous_quality_status = Column(String(50), nullable=True)
    scan_timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    work_order = relationship("WorkOrder")
    stage = relationship("ProductionStage")
    operator = relationship("Operator", foreign_keys=[operator_id])
    supervisor = relationship("Operator", foreign_keys=[supervisor_id])
    quality_inspector = relationship("Operator", foreign_keys=[quality_inspector_id])

    __table_args__ = (
        UniqueConstraint('work_order_id', 'stage_id', name='uq_work_order_stage'),
        CheckConstraint(
            "scan_type IN ('normal', 'first_article', 'update')",
            name="check_scan_type"
        ),
        CheckConstraint(
            "quality_status IN ('ok', 'not_ok', 'ok_update', 'not_ok_update')",
            name="check_quality_status"
        ),
    )

    def __repr__(self):
        return f"<ScanRecord(id={self.id}, wo={self.work_order_id}, stage={self.stage_id}, status={self.quality_status})>"
