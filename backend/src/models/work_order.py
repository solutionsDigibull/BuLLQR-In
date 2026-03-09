"""Work order model for tracking cables through production."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, CheckConstraint
from src.models.types import GUID
from sqlalchemy.orm import relationship
from src.database import Base


class WorkOrder(Base):
    """
    Tracks individual work orders (cables) through the production process.

    Work orders progress through 5 stages: Cutting → Stripping → Crimping → Testing → Final Inspection.
    Each work order has a unique barcode (20-50 characters) and auto-generated serial number.
    """

    __tablename__ = "work_orders"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    work_order_code = Column(String(50), unique=True, nullable=False, index=True)
    serial_number = Column(String(10), nullable=False, index=True)
    product_id = Column(GUID, ForeignKey('products.id', ondelete='SET NULL'), nullable=True)
    current_stage_id = Column(GUID, ForeignKey('production_stages.id', ondelete='SET NULL'), nullable=True, index=True)
    overall_quality_status = Column(String(50), nullable=False, default='pending', index=True)
    is_completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = relationship("Product")
    current_stage = relationship("ProductionStage")

    __table_args__ = (
        CheckConstraint(
            "LENGTH(work_order_code) BETWEEN 20 AND 50",
            name="check_work_order_code_length"
        ),
        CheckConstraint(
            "overall_quality_status IN ('pending', 'ok', 'not_ok')",
            name="check_overall_quality_status"
        ),
    )

    def __repr__(self):
        return f"<WorkOrder(id={self.id}, code={self.work_order_code}, serial={self.serial_number})>"
