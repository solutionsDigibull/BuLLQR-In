"""Error response schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """
    Standardized error response for all API errors.

    Used for consistent error formatting across all endpoints.
    """

    error: str  # Error type (e.g., "ValidationError", "NotFoundError")
    detail: str  # Human-readable error message
    code: int  # HTTP status code
    timestamp: datetime
    path: Optional[str] = None  # Request path where error occurred

    class Config:
        schema_extra = {
            "example": {
                "error": "ValidationError",
                "detail": "Barcode must be between 20 and 50 characters",
                "code": 400,
                "timestamp": "2025-02-05T10:30:00",
                "path": "/api/v1/scan"
            }
        }
