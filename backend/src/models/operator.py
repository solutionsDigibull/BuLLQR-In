"""Operator model for user accounts."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, CheckConstraint
from src.database import Base
from src.models.types import GUID


class Operator(Base):
    """
    User accounts for all system users.

    Roles:
    - operator: Production floor workers who scan cables
    - quality_inspector: Personnel who approve first articles
    - supervisor: Personnel who approve subsequent scans and view analytics
    - admin: Managers who configure products, targets, and costs
    """

    __tablename__ = "operators"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)
    station_id = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "role IN ('operator', 'quality_inspector', 'supervisor', 'admin')",
            name="check_operator_role"
        ),
    )

    def __repr__(self):
        return f"<Operator(id={self.id}, username={self.username}, role={self.role})>"
