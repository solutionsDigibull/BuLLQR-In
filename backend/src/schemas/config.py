"""Schemas for configuration management."""
from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field
import uuid


class ProductCreateRequest(BaseModel):
    """
    Create new product configuration.

    Product codes must be unique and production targets must be positive.
    """

    product_code: str = Field(..., max_length=100)
    product_name: str = Field(..., max_length=255)
    production_target: Optional[int] = Field(None, ge=1)

    class Config:
        schema_extra = {
            "example": {
                "product_code": "CABLE-002",
                "product_name": "100ft Ethernet Cable",
                "production_target": 500
            }
        }


class ProductUpdateRequest(BaseModel):
    """
    Update product configuration.

    All fields are optional - only provided fields will be updated.
    """

    product_name: Optional[str] = Field(None, max_length=255)
    production_target: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None

    class Config:
        schema_extra = {
            "example": {
                "production_target": 1200,
                "is_active": True
            }
        }


class ProductResponse(BaseModel):
    """
    Product configuration response.

    Returns full product details including current status.
    """

    id: uuid.UUID
    product_code: str
    product_name: str
    is_active: bool
    production_target: Optional[int]
    target_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": "990e8400-e29b-41d4-a716-446655440004",
                "product_code": "CABLE-001",
                "product_name": "50ft Ethernet Cable",
                "is_active": True,
                "production_target": 1000,
                "target_status": "in_progress",
                "created_at": "2025-02-01T08:00:00",
                "updated_at": "2025-02-05T10:00:00"
            }
        }


class ReworkCostUpdateRequest(BaseModel):
    """
    Update rework cost for a stage.

    Cost must be non-negative with 2 decimal places.
    """

    cost_per_rework: Decimal = Field(..., ge=0, decimal_places=2)

    class Config:
        schema_extra = {
            "example": {
                "cost_per_rework": "10.50"
            }
        }


class OperatorCreateRequest(BaseModel):
    """
    Create new operator account.

    Username must be unique, password must be at least 8 characters,
    role must be one of: operator, quality_inspector, supervisor, admin.
    """

    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., max_length=255)
    role: str = Field(..., pattern="^(operator|quality_inspector|supervisor|admin)$")
    station_id: Optional[str] = Field(None, max_length=100)

    class Config:
        schema_extra = {
            "example": {
                "username": "jdoe",
                "password": "SecureP@ss123",
                "full_name": "John Doe",
                "role": "operator",
                "station_id": "STATION-02"
            }
        }


class OperatorResponse(BaseModel):
    """
    Operator account response.

    Password is never included in responses for security.
    """

    id: uuid.UUID
    username: str
    full_name: str
    role: str
    station_id: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": "aa0e8400-e29b-41d4-a716-446655440005",
                "username": "jdoe",
                "full_name": "John Doe",
                "role": "operator",
                "station_id": "STATION-02",
                "is_active": True,
                "created_at": "2025-02-01T08:00:00"
            }
        }
