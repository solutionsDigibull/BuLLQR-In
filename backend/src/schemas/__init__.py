"""Pydantic schemas for request/response validation."""
from src.schemas.errors import ErrorResponse
from src.schemas.scan import ScanRequest, ScanResponse, WorkOrderStatusResponse
from src.schemas.analytics import (
    StageStats,
    ProductionStatsResponse,
    ReworkCostItem,
    COPQReportResponse,
    AnalyticsQueryParams
)
from src.schemas.config import (
    ProductCreateRequest,
    ProductUpdateRequest,
    ProductResponse,
    ReworkCostUpdateRequest,
    OperatorCreateRequest,
    OperatorResponse
)

__all__ = [
    # Errors
    "ErrorResponse",
    # Scan
    "ScanRequest",
    "ScanResponse",
    "WorkOrderStatusResponse",
    # Analytics
    "StageStats",
    "ProductionStatsResponse",
    "ReworkCostItem",
    "COPQReportResponse",
    "AnalyticsQueryParams",
    # Config
    "ProductCreateRequest",
    "ProductUpdateRequest",
    "ProductResponse",
    "ReworkCostUpdateRequest",
    "OperatorCreateRequest",
    "OperatorResponse",
]
