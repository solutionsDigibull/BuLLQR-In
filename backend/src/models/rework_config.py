"""Rework configuration model for rework types with COPQ costs."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Text, DateTime
from src.models.types import GUID
from src.database import Base


class ReworkConfig(Base):
    """
    Rework type definitions with associated Cost of Poor Quality (COPQ).

    Each rework type has a detail description, cost, and active status.
    Soft-deleted by setting is_active=False.
    """

    __tablename__ = "rework_configs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    rework_detail = Column(String(200), unique=True, nullable=False, index=True)
    copq_cost = Column(Numeric(10, 2), nullable=False, default=0.00)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ReworkConfig(id={self.id}, detail={self.rework_detail}, cost={self.copq_cost})>"
