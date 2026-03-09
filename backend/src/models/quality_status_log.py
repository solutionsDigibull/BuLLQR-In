"""Quality status log model for audit trail."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, CheckConstraint
from src.models.types import GUID
from sqlalchemy.orm import relationship
from src.database import Base


class QualityStatusLog(Base):
    """
    Audit trail for all quality status changes (updates).

    Logs every status change with:
    - Original scan record reference
    - Work order and stage context
    - Operator who made the change
    - Previous and new status
    - Optional reason for change
    - Timestamp of change

    Used for compliance tracking and quality analysis.
    """

    __tablename__ = "quality_status_log"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    scan_record_id = Column(GUID, ForeignKey('scan_records.id', ondelete='CASCADE'), nullable=False, index=True)
    work_order_id = Column(GUID, ForeignKey('work_orders.id', ondelete='CASCADE'), nullable=False, index=True)
    stage_id = Column(GUID, ForeignKey('production_stages.id', ondelete='CASCADE'), nullable=False)
    operator_id = Column(GUID, ForeignKey('operators.id', ondelete='SET NULL'), nullable=False, index=True)
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    change_reason = Column(Text, nullable=True)
    changed_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    scan_record = relationship("ScanRecord")
    work_order = relationship("WorkOrder")
    stage = relationship("ProductionStage")
    operator = relationship("Operator")

    __table_args__ = (
        CheckConstraint(
            "previous_status IN ('ok', 'not_ok', 'ok_update', 'not_ok_update')",
            name="check_previous_status"
        ),
        CheckConstraint(
            "new_status IN ('ok', 'not_ok', 'ok_update', 'not_ok_update')",
            name="check_new_status"
        ),
        CheckConstraint(
            "previous_status != new_status",
            name="check_status_different"
        ),
    )

    def __repr__(self):
        return f"<QualityStatusLog(id={self.id}, wo={self.work_order_id}, {self.previous_status}→{self.new_status})>"
