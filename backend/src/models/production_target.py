"""Production target model for daily production quantity tracking."""
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, Date, Boolean, DateTime
from src.models.types import GUID
from src.database import Base


class ProductionTarget(Base):
    """
    Daily production targets.

    Tracks target quantity per day, completion status, and timestamps.
    Only one target per date is allowed.
    """

    __tablename__ = "production_targets"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    target_date = Column(Date, unique=True, nullable=False, index=True)
    target_quantity = Column(Integer, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ProductionTarget(date={self.target_date}, qty={self.target_quantity}, done={self.is_completed})>"
