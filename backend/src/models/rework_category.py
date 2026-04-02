"""Rework category model for grouping rework types."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from src.models.types import GUID
from src.database import Base


class ReworkCategory(Base):
    """
    Rework category (Rework Name) for grouping rework config types.

    Each category groups related rework types under a common name
    (e.g., 'Input AMP', 'Output AMP').
    """

    __tablename__ = "rework_categories"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    rework_configs = relationship(
        "ReworkConfig",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="ReworkConfig.rework_detail",
    )

    def __repr__(self):
        return f"<ReworkCategory(id={self.id}, name={self.name})>"
