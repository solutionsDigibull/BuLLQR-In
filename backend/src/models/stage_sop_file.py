"""SOP file attachments for production stages."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, LargeBinary, DateTime, ForeignKey
from src.database import Base
from src.models.types import GUID


class StageSopFile(Base):
    """File attachments (images, videos, text, PDFs) for production stage SOPs."""

    __tablename__ = "stage_sop_files"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    stage_id = Column(GUID, ForeignKey("production_stages.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    content = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<StageSopFile(id={self.id}, stage_id={self.stage_id}, filename={self.original_filename})>"
