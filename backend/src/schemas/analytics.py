"""Schemas for analytics and reporting."""
from datetime import datetime, date
from typing import Optional, Dict, List
from decimal import Decimal
from pydantic import BaseModel
import uuid


class StageStats(BaseModel):
    """Statistics for a single production stage."""

    stage_name: str
    stage_sequence: int
    completed_count: int
    pending_approval_count: int
    rejected_count: int
    average_time_minutes: Optional[float]

    class Config:
        schema_extra = {
            "example": {
                "stage_name": "Cutting",
                "stage_sequence": 1,
                "completed_count": 150,
                "pending_approval_count": 2,
                "rejected_count": 3,
                "average_time_minutes": 5.5
            }
        }


class ProductionStatsResponse(BaseModel):
    """
    Real-time production statistics.

    Provides current production status, target progress, and stage breakdown.
    """

    active_product_code: str
    active_product_name: str
    production_target: Optional[int]
    total_completed: int
    completion_percentage: Optional[float]
    stage_breakdown: List[StageStats]
    quality_summary: Dict[str, int]  # {approved: 150, rejected: 5, pending: 3}
    timestamp: datetime

    class Config:
        schema_extra = {
            "example": {
                "active_product_code": "CABLE-001",
                "active_product_name": "50ft Ethernet Cable",
                "production_target": 1000,
                "total_completed": 750,
                "completion_percentage": 75.0,
                "stage_breakdown": [
                    {
                        "stage_name": "Cutting",
                        "stage_sequence": 1,
                        "completed_count": 750,
                        "pending_approval_count": 0,
                        "rejected_count": 2,
                        "average_time_minutes": 5.5
                    }
                ],
                "quality_summary": {"approved": 745, "rejected": 3, "pending": 2},
                "timestamp": "2025-02-05T14:30:00"
            }
        }


class ReworkCostItem(BaseModel):
    """Single rework cost entry for a stage."""

    stage_name: str
    rejection_count: int
    cost_per_rework: Decimal
    total_cost: Decimal

    class Config:
        schema_extra = {
            "example": {
                "stage_name": "Crimping",
                "rejection_count": 5,
                "cost_per_rework": "10.00",
                "total_cost": "50.00"
            }
        }


class COPQReportResponse(BaseModel):
    """
    Cost of Poor Quality (COPQ) report.

    Calculates total rework costs and rejection rates for a product/date range.
    """

    product_code: str
    product_name: str
    date_range_start: datetime
    date_range_end: datetime
    total_rework_costs: Decimal
    rework_breakdown: List[ReworkCostItem]
    total_rejections: int
    rejection_rate_percentage: float

    class Config:
        schema_extra = {
            "example": {
                "product_code": "CABLE-001",
                "product_name": "50ft Ethernet Cable",
                "date_range_start": "2025-02-01T00:00:00",
                "date_range_end": "2025-02-05T23:59:59",
                "total_rework_costs": "150.00",
                "rework_breakdown": [
                    {
                        "stage_name": "Crimping",
                        "rejection_count": 5,
                        "cost_per_rework": "10.00",
                        "total_cost": "50.00"
                    },
                    {
                        "stage_name": "Testing",
                        "rejection_count": 10,
                        "cost_per_rework": "10.00",
                        "total_cost": "100.00"
                    }
                ],
                "total_rejections": 15,
                "rejection_rate_percentage": 2.0
            }
        }


class AnalyticsQueryParams(BaseModel):
    """Query parameters for analytics endpoints."""

    start_date: Optional[date] = None
    end_date: Optional[date] = None
    product_code: Optional[str] = None
    stage_id: Optional[uuid.UUID] = None

    class Config:
        schema_extra = {
            "example": {
                "start_date": "2025-02-01",
                "end_date": "2025-02-05",
                "product_code": "CABLE-001"
            }
        }
