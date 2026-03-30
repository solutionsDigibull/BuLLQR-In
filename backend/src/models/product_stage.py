"""Association table linking products to their production stages."""
import uuid
from sqlalchemy import Boolean, Column, ForeignKey, Integer, UniqueConstraint
from src.database import Base
from src.models.types import GUID


class ProductStage(Base):
    """
    Many-to-many link between products and production stages.

    Each product can have a subset of the global stages assigned to it.
    Only assigned stages appear in the scan page dropdown for that product.
    The sequence column allows per-product stage ordering.
    """

    __tablename__ = "product_stages"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    product_id = Column(GUID, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(GUID, ForeignKey("production_stages.id", ondelete="CASCADE"), nullable=False)
    sequence = Column(Integer, nullable=False, default=1)
    is_mandatory = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        UniqueConstraint("product_id", "stage_id", name="uq_product_stage"),
    )

    def __repr__(self):
        return f"<ProductStage(product_id={self.product_id}, stage_id={self.stage_id}, seq={self.sequence})>"
