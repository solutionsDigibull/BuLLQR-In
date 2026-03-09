"""Rework history model for tracking rework applied to rejected cables."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Text, DateTime, ForeignKey
from src.models.types import GUID
from sqlalchemy.orm import relationship
from src.database import Base


class ReworkHistory(Base):
    """
    Tracks rework applied to rejected cables (NOT OK scans).

    Each entry records which rework type was applied, the cost,
    who applied it, and when. The is_active flag allows replacing
    rework types — old entries are deactivated when a new type is applied.
    """

    __tablename__ = "rework_history"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    work_order_id = Column(GUID, ForeignKey('work_orders.id', ondelete='CASCADE'), nullable=False, index=True)
    scan_record_id = Column(GUID, ForeignKey('scan_records.id', ondelete='CASCADE'), nullable=False, index=True)
    rework_config_id = Column(GUID, ForeignKey('rework_configs.id', ondelete='SET NULL'), nullable=True)
    rework_detail = Column(String(200), nullable=False)
    copq_cost = Column(Numeric(10, 2), nullable=False, default=0.00)
    stage_id = Column(GUID, ForeignKey('production_stages.id', ondelete='SET NULL'), nullable=True)
    stage_name = Column(String(100), nullable=True)
    operator_name = Column(String(100), nullable=True)
    applied_by = Column(String(100), nullable=False)
    rework_date = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    work_order = relationship("WorkOrder")
    scan_record = relationship("ScanRecord", backref="rework_entries")
    rework_config = relationship("ReworkConfig")
    stage = relationship("ProductionStage")

    def __repr__(self):
        return f"<ReworkHistory(id={self.id}, scan={self.scan_record_id}, detail={self.rework_detail})>"
