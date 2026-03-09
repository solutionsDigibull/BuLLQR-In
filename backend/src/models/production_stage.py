"""Production stage model for the 5 fixed stages."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime
from src.database import Base
from src.models.types import GUID


class ProductionStage(Base):
    """
    The 5 fixed production stages in sequence.

    Stages:
    1. Cutting
    2. Stripping
    3. Crimping
    4. Testing
    5. Final Inspection

    Stage sequence enforces workflow order at application level.
    """

    __tablename__ = "production_stages"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    stage_name = Column(String(100), unique=True, nullable=False, index=True)
    stage_sequence = Column(Integer, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<ProductionStage(id={self.id}, name={self.stage_name}, seq={self.stage_sequence})>"
