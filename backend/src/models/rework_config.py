"""Rework configuration model for rework types with COPQ costs."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from src.models.types import GUID
from src.database import Base


class ReworkConfig(Base):
    """
    Rework type definitions with associated Cost of Poor Quality (COPQ).

    Each rework type belongs to a category (ReworkCategory) and has a
    detail description, cost, and active status.
    """

    __tablename__ = "rework_configs"
    __table_args__ = (
        UniqueConstraint('category_id', 'rework_detail', name='uq_category_rework_detail'),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    category_id = Column(GUID, ForeignKey('rework_categories.id', ondelete='CASCADE'), nullable=True, index=True)
    rework_detail = Column(String(200), nullable=False, index=True)
    copq_cost = Column(Numeric(10, 2), nullable=False, default=0.00)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("ReworkCategory", back_populates="rework_configs")

    def __repr__(self):
        return f"<ReworkConfig(id={self.id}, detail={self.rework_detail}, cost={self.copq_cost})>"
