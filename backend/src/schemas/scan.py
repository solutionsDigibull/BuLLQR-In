"""Schemas for scan operations."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, validator
import uuid


class ScanRequest(BaseModel):
    """
    Request schema for barcode scan.

    Validates barcode format (20-50 alphanumeric characters) and normalizes to uppercase.
    For first article scans, quality_inspector_id must be provided.
    """

    barcode: str = Field(
        ...,
        min_length=20,
        max_length=100,
        description="Work order barcode (20-100 characters)"
    )
    stage_id: uuid.UUID = Field(..., description="Production stage UUID")
    operator_id: uuid.UUID = Field(..., description="Operator UUID performing scan")
    station_id: Optional[str] = Field(None, max_length=100, description="Workstation identifier")
    supervisor_id: Optional[uuid.UUID] = Field(
        None,
        description="Supervisor UUID for this scan session"
    )
    quality_inspector_id: Optional[uuid.UUID] = Field(
        None,
        description="Quality Inspector UUID (required for first article inspection)"
    )
    quality_status: Optional[str] = Field(
        "ok",
        description="Quality status: ok, not_ok, ok_update, not_ok_update"
    )
    product_id: Optional[uuid.UUID] = Field(
        None,
        description="Product UUID to associate with new work orders"
    )

    @validator('quality_status')
    def validate_quality_status(cls, v):
        """Validate quality status is one of the allowed values."""
        allowed = ['ok', 'not_ok', 'ok_update', 'not_ok_update']
        if v not in allowed:
            raise ValueError(f'quality_status must be one of {allowed}')
        return v

    @validator('barcode')
    def validate_barcode_format(cls, v):
        """Normalize barcode to uppercase."""
        return v.strip().upper()

    class Config:
        schema_extra = {
            "example": {
                "barcode": "TREO-TRAND-12345-001",
                "stage_id": "550e8400-e29b-41d4-a716-446655440000",
                "operator_id": "660e8400-e29b-41d4-a716-446655440001",
                "station_id": "STATION-01"
            }
        }


class ScanResponse(BaseModel):
    """
    Response schema for successful scan.

    Returns scan details including quality status and next action required.
    """

    scan_id: uuid.UUID
    work_order_id: uuid.UUID
    barcode: str
    stage_name: str
    stage_sequence: int
    operator_name: str
    requires_first_article: bool
    quality_status: str  # pending_approval, approved, rejected
    scanned_at: datetime
    message: str

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "scan_id": "770e8400-e29b-41d4-a716-446655440002",
                "work_order_id": "880e8400-e29b-41d4-a716-446655440003",
                "barcode": "TREO-TRAND-12345-001",
                "stage_name": "Cutting",
                "stage_sequence": 1,
                "operator_name": "John Doe",
                "requires_first_article": True,
                "quality_status": "pending_approval",
                "scanned_at": "2025-02-05T10:30:00",
                "message": "First article - awaiting quality approval"
            }
        }


class WorkOrderStatusResponse(BaseModel):
    """
    Work order status with completed stages.

    Shows current progress and quality status for a work order.
    """

    work_order_id: uuid.UUID
    barcode: str
    product_code: str
    product_name: str
    current_stage: Optional[str]
    current_stage_sequence: Optional[int]
    completed_stages: list[str]
    total_stages: int
    quality_status: str
    is_completed: bool
    created_at: datetime

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "work_order_id": "880e8400-e29b-41d4-a716-446655440003",
                "barcode": "TREO-TRAND-12345-001",
                "product_code": "CABLE-001",
                "product_name": "50ft Ethernet Cable",
                "current_stage": "Stripping",
                "current_stage_sequence": 2,
                "completed_stages": ["Cutting"],
                "total_stages": 5,
                "quality_status": "approved",
                "is_completed": False,
                "created_at": "2025-02-05T08:00:00"
            }
        }


class QualityStatusUpdateRequest(BaseModel):
    """
    Request schema for updating quality status of a scan.

    Used to correct quality status (OK UPDATE/NOT OK UPDATE) after initial scan.
    Requires operator_id and prevents duplicate status updates.
    """

    new_status: str = Field(
        ...,
        description="New quality status (ok_update or not_ok_update)"
    )
    operator_id: uuid.UUID = Field(
        ...,
        description="Operator UUID performing the update"
    )
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional reason for status change"
    )

    @validator('new_status')
    def validate_status(cls, v):
        """Validate that status is an update status."""
        allowed = ['ok_update', 'not_ok_update']
        if v not in allowed:
            raise ValueError(f'Status must be one of {allowed}. Use ok_update or not_ok_update for updates.')
        return v

    class Config:
        schema_extra = {
            "example": {
                "new_status": "not_ok_update",
                "operator_id": "660e8400-e29b-41d4-a716-446655440001",
                "reason": "Found defect during rework inspection"
            }
        }


class QualityStatusUpdateResponse(BaseModel):
    """
    Response schema for quality status update.

    Returns updated status and audit trail reference.
    """

    scan_id: uuid.UUID
    work_order_id: uuid.UUID
    barcode: str
    stage_name: str
    previous_status: str
    new_status: str
    updated_by: str
    updated_at: datetime
    message: str

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "scan_id": "770e8400-e29b-41d4-a716-446655440002",
                "work_order_id": "880e8400-e29b-41d4-a716-446655440003",
                "barcode": "TREO-TRAND-12345-001",
                "stage_name": "Cutting",
                "previous_status": "ok",
                "new_status": "not_ok_update",
                "updated_by": "Jane Smith",
                "updated_at": "2025-02-05T14:30:00",
                "message": "Quality status updated successfully"
            }
        }
