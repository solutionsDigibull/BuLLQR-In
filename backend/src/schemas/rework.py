"""Schemas for rework config, rework history, and COPQ."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid


# --- Rework Config Schemas ---

class ReworkConfigCreateBody(BaseModel):
    rework_detail: str = Field(..., min_length=1, max_length=200)
    copq_cost: float = Field(..., ge=0)
    description: Optional[str] = None


class ReworkConfigUpdateBody(BaseModel):
    rework_detail: Optional[str] = Field(None, min_length=1, max_length=200)
    copq_cost: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ReworkConfigResponse(BaseModel):
    id: str
    rework_detail: str
    copq_cost: float
    description: Optional[str]
    is_active: bool
    created_at: Optional[str]
    updated_at: Optional[str]


# --- Rework History / Apply Rework Schemas ---

class ApplyReworkBody(BaseModel):
    scan_record_id: uuid.UUID
    work_order_id: uuid.UUID
    rework_config_id: uuid.UUID
    applied_by: str = Field(..., min_length=1, max_length=100)
    notes: Optional[str] = None


class ReworkHistoryResponse(BaseModel):
    id: str
    work_order_id: str
    scan_record_id: str
    rework_config_id: Optional[str]
    rework_detail: str
    copq_cost: float
    stage_name: Optional[str]
    operator_name: Optional[str]
    applied_by: str
    rework_date: str
    notes: Optional[str]
    is_active: bool


# --- Rejected Cables ---

class RejectedCableResponse(BaseModel):
    scan_id: str
    work_order_id: str
    work_order_code: str
    serial_number: Optional[str]
    stage_name: str
    stage_id: str
    operator_name: str
    quality_status: str
    scan_timestamp: str
    rework_detail: Optional[str] = None
    rework_copq_cost: Optional[float] = None
    rework_applied_by: Optional[str] = None
    rework_date: Optional[str] = None
    rework_history_id: Optional[str] = None


# --- COPQ Summary ---

class COPQStageDetail(BaseModel):
    stage_name: str
    rejection_count: int
    reworked_count: int
    total_copq_cost: float
    rework_details: List[dict]


class COPQSummaryResponse(BaseModel):
    total_rejected: int
    total_reworked: int
    total_copq_cost: float
    by_stage: List[COPQStageDetail]
    date_range: dict
