"""Product model for cable product configurations."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, CheckConstraint
from src.database import Base
from src.models.types import GUID


class Product(Base):
    """
    Product configurations with active status.

    Only one product can be marked as active at a time (currently in production).
    Production targets are set per product and persist until manually completed.
    """

    __tablename__ = "products"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    product_code = Column(String(100), unique=True, nullable=False, index=True)
    product_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=False, index=True)
    production_target = Column(Integer, nullable=True)
    target_status = Column(String(50), nullable=False, default='not_set')
    target_set_at = Column(DateTime, nullable=True)
    target_completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "target_status IN ('not_set', 'in_progress', 'completed')",
            name="check_target_status"
        ),
    )

    def __repr__(self):
        return f"<Product(id={self.id}, code={self.product_code}, active={self.is_active})>"
