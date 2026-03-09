"""Rework cost model for cost configuration."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, CheckConstraint
from src.models.types import GUID
from sqlalchemy.orm import relationship
from src.database import Base


class ReworkCost(Base):
    """
    Cost configuration for rework at each production stage.

    Used to calculate Cost of Poor Quality (COPQ).
    One cost configuration per stage.
    Costs can be updated; effective_from tracks when changes take effect.
    """

    __tablename__ = "rework_costs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    stage_id = Column(GUID, ForeignKey('production_stages.id', ondelete='CASCADE'), unique=True, nullable=False, index=True)
    cost_per_rework = Column(Numeric(10, 2), nullable=False, default=0.00)
    currency = Column(String(10), nullable=False, default='USD')
    effective_from = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    stage = relationship("ProductionStage")

    __table_args__ = (
        CheckConstraint(
            "cost_per_rework >= 0",
            name="check_cost_non_negative"
        ),
    )

    def __repr__(self):
        return f"<ReworkCost(id={self.id}, stage={self.stage_id}, cost={self.cost_per_rework} {self.currency})>"
