"""Configuration management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, date
from src.database import get_db
from src.models import Product, ProductionStage, ProductStage, ReworkCost, Operator, ScanRecord, StageSopFile
from src.models.rework_category import ReworkCategory
from src.models.rework_config import ReworkConfig
from src.models.production_target import ProductionTarget
from src.auth.password import hash_password
from src.auth.rbac import require_role
from pydantic import BaseModel, Field
import uuid

router = APIRouter(prefix="/api/v1/config", tags=["config"])


# ========== Stages ==========

class StageCreateBody(BaseModel):
    stage_name: str = Field(..., min_length=1, max_length=100)
    stage_sequence: Optional[int] = Field(None, ge=1)
    description: Optional[str] = None

class StageUpdateBody(BaseModel):
    stage_name: Optional[str] = Field(None, min_length=1, max_length=100)
    stage_sequence: Optional[int] = Field(None, ge=1)
    description: Optional[str] = None


@router.get("/stages")
async def list_stages(db: Session = Depends(get_db)):
    """List all production stages with SOP file counts."""
    stages = db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()
    # Build sop_count map in a single query
    sop_counts = dict(
        db.query(StageSopFile.stage_id, func.count(StageSopFile.id))
        .group_by(StageSopFile.stage_id)
        .all()
    )
    return {
        "stages": [
            {
                "id": str(s.id),
                "stage_name": s.stage_name,
                "stage_sequence": s.stage_sequence,
                "description": s.description,
                "sop_count": sop_counts.get(s.id, 0),
            }
            for s in stages
        ]
    }


@router.post("/stages", status_code=status.HTTP_201_CREATED)
async def create_stage(
    body: StageCreateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Create a new production stage."""
    existing_name = db.query(ProductionStage).filter(ProductionStage.stage_name == body.stage_name).first()
    if existing_name:
        raise HTTPException(status_code=409, detail="Stage name already exists")

    # Auto-assign sequence: max existing + 1
    if body.stage_sequence is not None:
        seq = body.stage_sequence
        existing_seq = db.query(ProductionStage).filter(ProductionStage.stage_sequence == seq).first()
        if existing_seq:
            raise HTTPException(status_code=409, detail="Stage sequence already taken")
    else:
        from sqlalchemy import func
        max_seq = db.query(func.max(ProductionStage.stage_sequence)).scalar() or 0
        seq = max_seq + 1

    stage = ProductionStage(
        id=uuid.uuid4(),
        stage_name=body.stage_name,
        stage_sequence=seq,
        description=body.description,
    )
    db.add(stage)

    # Also create a default ReworkCost entry
    rc = ReworkCost(
        id=uuid.uuid4(),
        stage_id=stage.id,
        cost_per_rework=0.00,
    )
    db.add(rc)

    db.commit()
    db.refresh(stage)
    return {
        "id": str(stage.id),
        "stage_name": stage.stage_name,
        "stage_sequence": stage.stage_sequence,
        "description": stage.description,
    }


@router.put("/stages/{stage_id}")
async def update_stage(
    stage_id: str,
    body: StageUpdateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Update a production stage."""
    stage = db.query(ProductionStage).filter(ProductionStage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    if body.stage_name is not None:
        dup = db.query(ProductionStage).filter(
            ProductionStage.stage_name == body.stage_name, ProductionStage.id != stage.id
        ).first()
        if dup:
            raise HTTPException(status_code=409, detail="Stage name already exists")
        stage.stage_name = body.stage_name
    if body.stage_sequence is not None:
        dup = db.query(ProductionStage).filter(
            ProductionStage.stage_sequence == body.stage_sequence, ProductionStage.id != stage.id
        ).first()
        if dup:
            raise HTTPException(status_code=409, detail="Stage sequence already taken")
        stage.stage_sequence = body.stage_sequence
    if body.description is not None:
        stage.description = body.description
    db.commit()
    db.refresh(stage)
    return {
        "id": str(stage.id),
        "stage_name": stage.stage_name,
        "stage_sequence": stage.stage_sequence,
        "description": stage.description,
    }


@router.delete("/stages/{stage_id}")
async def delete_stage(
    stage_id: str,
    force: bool = Query(False, description="Force delete even if scan records exist"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Delete a production stage. Use force=true to cascade-delete related records."""
    from sqlalchemy import text

    try:
        stage_uuid = uuid.UUID(stage_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid stage ID format")

    stage = db.query(ProductionStage).filter(ProductionStage.id == stage_uuid).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    # Check for related scan records
    scan_count = db.query(ScanRecord).filter(ScanRecord.stage_id == stage_uuid).count()
    if scan_count > 0 and not force:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete stage with {scan_count} existing scan records. Use force delete to remove stage and all related data.",
        )

    # Get all scan_record IDs for this stage (needed to clean child tables)
    scan_ids = [
        row[0] for row in
        db.query(ScanRecord.id).filter(ScanRecord.stage_id == stage_uuid).all()
    ]

    # Clean up related records in correct FK dependency order using raw SQL
    if scan_ids:
        scan_id_list = [str(sid) for sid in scan_ids]
        placeholders = ",".join([f"'{sid}'" for sid in scan_id_list])
        # rework_history & quality_status_log reference scan_records — delete first
        db.execute(text(f"DELETE FROM rework_history WHERE scan_record_id IN ({placeholders})"))
        db.execute(text(f"DELETE FROM quality_status_log WHERE scan_record_id IN ({placeholders})"))

    # Now delete scan_records for this stage
    db.execute(text("DELETE FROM scan_records WHERE stage_id = :sid"), {"sid": str(stage_uuid)})
    # Delete rework_history that only references the stage (not via scan)
    db.execute(text("UPDATE rework_history SET stage_id = NULL WHERE stage_id = :sid"), {"sid": str(stage_uuid)})
    # Delete other direct references
    db.execute(text("DELETE FROM rework_costs WHERE stage_id = :sid"), {"sid": str(stage_uuid)})
    db.execute(text("DELETE FROM product_stages WHERE stage_id = :sid"), {"sid": str(stage_uuid)})
    # Finally delete the stage
    db.execute(text("DELETE FROM production_stages WHERE id = :sid"), {"sid": str(stage_uuid)})
    db.commit()
    return {"message": "Stage deleted", "id": stage_id}


# ========== Stage SOP Files ==========

@router.post("/stages/{stage_id}/sop", status_code=status.HTTP_201_CREATED)
async def upload_sop_file(
    stage_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Upload an SOP file (image, video, text, PDF) for a stage."""
    try:
        stage_uuid = uuid.UUID(stage_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid stage ID format")

    stage = db.query(ProductionStage).filter(ProductionStage.id == stage_uuid).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File size exceeds 10 MB limit")
    mime_type = file.content_type or "application/octet-stream"

    sop = StageSopFile(
        id=uuid.uuid4(),
        stage_id=stage_uuid,
        original_filename=file.filename or "file",
        mime_type=mime_type,
        file_size=len(content),
        content=content,
        created_at=datetime.utcnow(),
    )
    db.add(sop)
    db.commit()
    db.refresh(sop)
    return {
        "id": str(sop.id),
        "stage_id": str(sop.stage_id),
        "original_filename": sop.original_filename,
        "mime_type": sop.mime_type,
        "file_size": sop.file_size,
        "created_at": sop.created_at.isoformat(),
    }


@router.get("/stages/{stage_id}/sop")
async def list_sop_files(
    stage_id: str,
    db: Session = Depends(get_db),
):
    """List SOP file metadata for a stage (no binary content)."""
    try:
        stage_uuid = uuid.UUID(stage_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid stage ID format")

    files = (
        db.query(StageSopFile)
        .filter(StageSopFile.stage_id == stage_uuid)
        .order_by(StageSopFile.created_at)
        .all()
    )
    return {
        "files": [
            {
                "id": str(f.id),
                "stage_id": str(f.stage_id),
                "original_filename": f.original_filename,
                "mime_type": f.mime_type,
                "file_size": f.file_size,
                "created_at": f.created_at.isoformat(),
            }
            for f in files
        ]
    }


@router.get("/stages/{stage_id}/sop/{file_id}/content")
async def get_sop_file_content(
    stage_id: str,
    file_id: str,
    db: Session = Depends(get_db),
):
    """Stream SOP file binary content for inline display."""
    try:
        stage_uuid = uuid.UUID(stage_id)
        file_uuid = uuid.UUID(file_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    sop = (
        db.query(StageSopFile)
        .filter(StageSopFile.id == file_uuid, StageSopFile.stage_id == stage_uuid)
        .first()
    )
    if not sop:
        raise HTTPException(status_code=404, detail="SOP file not found")

    return Response(
        content=sop.content,
        media_type=sop.mime_type,
        headers={"Content-Disposition": f'inline; filename="{sop.original_filename}"'},
    )


@router.delete("/stages/{stage_id}/sop/{file_id}")
async def delete_sop_file(
    stage_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Delete an SOP file."""
    try:
        stage_uuid = uuid.UUID(stage_id)
        file_uuid = uuid.UUID(file_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    sop = (
        db.query(StageSopFile)
        .filter(StageSopFile.id == file_uuid, StageSopFile.stage_id == stage_uuid)
        .first()
    )
    if not sop:
        raise HTTPException(status_code=404, detail="SOP file not found")

    db.delete(sop)
    db.commit()
    return {"message": "SOP file deleted", "id": file_id}


# ========== Products ==========

class ProductCreateBody(BaseModel):
    product_code: str
    product_name: str
    production_target: Optional[int] = None

class ProductUpdateBody(BaseModel):
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    is_active: Optional[bool] = None
    production_target: Optional[int] = None


def _product_dict(p: Product, db: Session = None):
    d = {
        "id": str(p.id),
        "product_code": p.product_code,
        "product_name": p.product_name,
        "is_active": p.is_active,
        "production_target": p.production_target,
        "target_status": p.target_status,
        "target_set_at": p.target_set_at.isoformat() if p.target_set_at else None,
        "target_completed_at": p.target_completed_at.isoformat() if p.target_completed_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
    if db is not None:
        links = (
            db.query(ProductStage.stage_id, ProductStage.sequence)
            .filter(ProductStage.product_id == p.id)
            .order_by(ProductStage.sequence)
            .all()
        )
        d["stage_ids"] = [str(row.stage_id) for row in links]
        d["stage_sequences"] = {str(row.stage_id): row.sequence for row in links}
    else:
        d["stage_ids"] = []
        d["stage_sequences"] = {}
    return d


@router.get("/products")
async def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.created_at).all()
    return {"products": [_product_dict(p, db) for p in products]}


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductCreateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing = db.query(Product).filter(Product.product_code == body.product_code).first()
    if existing:
        raise HTTPException(status_code=409, detail="Product code already exists")
    p = Product(
        id=uuid.uuid4(),
        product_code=body.product_code,
        product_name=body.product_name,
        production_target=body.production_target,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _product_dict(p, db)


@router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    body: ProductUpdateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    if body.product_code is not None:
        dup = db.query(Product).filter(
            Product.product_code == body.product_code,
            Product.id != p.id,
        ).first()
        if dup:
            raise HTTPException(status_code=409, detail="Product code already exists")
        p.product_code = body.product_code
    if body.product_name is not None:
        p.product_name = body.product_name
    if body.production_target is not None:
        p.production_target = body.production_target
    if body.is_active is not None:
        if body.is_active:
            db.query(Product).filter(Product.id != p.id).update({"is_active": False})
        p.is_active = body.is_active
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return _product_dict(p, db)


@router.post("/products/{product_id}/activate")
async def activate_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    db.query(Product).filter(Product.id != p.id).update({"is_active": False})
    p.is_active = True
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return _product_dict(p, db)


class TargetUpdateBody(BaseModel):
    production_target: int

@router.put("/products/{product_id}/target")
async def set_production_target(
    product_id: str,
    body: TargetUpdateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    p.production_target = body.production_target
    p.target_status = "in_progress"
    p.target_set_at = datetime.utcnow()
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return _product_dict(p, db)


@router.post("/products/{product_id}/target")
async def complete_production_target(
    product_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    p.target_status = "completed"
    p.target_completed_at = datetime.utcnow()
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return {"message": "Target completed", "product": _product_dict(p, db)}


# ========== Product-Stage Assignment ==========

class StageWithSequence(BaseModel):
    stage_id: str
    sequence: int = Field(..., ge=1)
    is_mandatory: bool = False

class ProductStagesBody(BaseModel):
    stages: List[StageWithSequence]


@router.get("/products/{product_id}/stages")
async def get_product_stages(
    product_id: str,
    db: Session = Depends(get_db),
):
    """Get stages assigned to a product (ordered by product-specific sequence)."""
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    rows = (
        db.query(ProductionStage, ProductStage.sequence, ProductStage.is_mandatory)
        .join(ProductStage, ProductStage.stage_id == ProductionStage.id)
        .filter(ProductStage.product_id == product_id)
        .order_by(ProductStage.sequence)
        .all()
    )
    sop_counts = dict(
        db.query(StageSopFile.stage_id, func.count(StageSopFile.id))
        .group_by(StageSopFile.stage_id)
        .all()
    )
    return {
        "stages": [
            {
                "id": str(s.id),
                "stage_name": s.stage_name,
                "stage_sequence": seq,
                "description": s.description,
                "is_mandatory": is_mandatory,
                "sop_count": sop_counts.get(s.id, 0),
            }
            for s, seq, is_mandatory in rows
        ]
    }


@router.put("/products/{product_id}/stages")
async def set_product_stages(
    product_id: str,
    body: ProductStagesBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Set (replace) the stages assigned to a product with per-stage sequence."""
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    stage_ids = [s.stage_id for s in body.stages]

    # Validate all stage_ids exist
    if stage_ids:
        existing = db.query(ProductionStage.id).filter(
            ProductionStage.id.in_(stage_ids)
        ).all()
        existing_ids = {str(row.id) for row in existing}
        missing = set(stage_ids) - existing_ids
        if missing:
            raise HTTPException(status_code=400, detail=f"Invalid stage IDs: {', '.join(missing)}")

    # Delete existing links and insert new ones
    db.query(ProductStage).filter(ProductStage.product_id == product_id).delete()
    for entry in body.stages:
        db.add(ProductStage(
            id=uuid.uuid4(),
            product_id=p.id,
            stage_id=entry.stage_id,
            sequence=entry.sequence,
            is_mandatory=entry.is_mandatory,
        ))
    db.commit()

    return _product_dict(p, db)


# ========== Rework Costs (per-stage) ==========

class ReworkCostUpdateBody(BaseModel):
    cost_per_rework: float
    currency: Optional[str] = None

@router.get("/rework-costs")
async def list_rework_costs(db: Session = Depends(get_db)):
    costs = db.query(ReworkCost).all()
    return {
        "costs": [
            {
                "id": str(c.id),
                "stage_id": str(c.stage_id),
                "stage_name": c.stage.stage_name if c.stage else None,
                "cost_per_rework": float(c.cost_per_rework),
                "currency": c.currency,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in costs
        ]
    }


@router.put("/rework-costs/{stage_id}")
async def update_rework_cost(
    stage_id: str,
    body: ReworkCostUpdateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    c = db.query(ReworkCost).filter(ReworkCost.stage_id == stage_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Rework cost config not found")
    c.cost_per_rework = body.cost_per_rework
    if body.currency:
        c.currency = body.currency
    c.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(c)
    return {
        "id": str(c.id),
        "stage_id": str(c.stage_id),
        "stage_name": c.stage.stage_name if c.stage else None,
        "cost_per_rework": float(c.cost_per_rework),
        "currency": c.currency,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ========== Rework Categories (rework name grouping) ==========

class ReworkCategoryCreateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class ReworkCategoryUpdateBody(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)


def _rework_config_dict(rc: ReworkConfig):
    return {
        "id": str(rc.id),
        "category_id": str(rc.category_id) if rc.category_id else None,
        "rework_detail": rc.rework_detail,
        "copq_cost": float(rc.copq_cost),
        "description": rc.description,
        "is_active": rc.is_active,
        "created_at": rc.created_at.isoformat() if rc.created_at else None,
        "updated_at": rc.updated_at.isoformat() if rc.updated_at else None,
    }


def _rework_category_dict(cat: ReworkCategory, include_configs=False):
    d = {
        "id": str(cat.id),
        "name": cat.name,
        "created_at": cat.created_at.isoformat() if cat.created_at else None,
        "updated_at": cat.updated_at.isoformat() if cat.updated_at else None,
    }
    if include_configs:
        d["rework_configs"] = [_rework_config_dict(rc) for rc in cat.rework_configs]
    return d


@router.get("/rework-categories")
async def list_rework_categories(
    include_configs: bool = Query(False),
    db: Session = Depends(get_db),
):
    """List all rework categories, optionally with their child configs."""
    cats = db.query(ReworkCategory).order_by(ReworkCategory.name).all()
    return {"rework_categories": [_rework_category_dict(c, include_configs) for c in cats]}


@router.post("/rework-categories", status_code=status.HTTP_201_CREATED)
async def create_rework_category(
    body: ReworkCategoryCreateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Create a new rework category (rework name)."""
    existing = db.query(ReworkCategory).filter(ReworkCategory.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category name already exists")
    cat = ReworkCategory(id=uuid.uuid4(), name=body.name, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _rework_category_dict(cat)


@router.put("/rework-categories/{category_id}")
async def update_rework_category(
    category_id: str,
    body: ReworkCategoryUpdateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Rename a rework category."""
    cat = db.query(ReworkCategory).filter(ReworkCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if body.name is not None:
        dup = db.query(ReworkCategory).filter(ReworkCategory.name == body.name, ReworkCategory.id != cat.id).first()
        if dup:
            raise HTTPException(status_code=409, detail="Category name already exists")
        cat.name = body.name
    cat.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cat)
    return _rework_category_dict(cat)


@router.delete("/rework-categories/{category_id}")
async def delete_rework_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Delete a rework category and all its child rework types."""
    cat = db.query(ReworkCategory).filter(ReworkCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
    return {"message": "Category deleted", "id": category_id}


# ========== Rework Configs (rework types with COPQ) ==========

class ReworkConfigCreateBody(BaseModel):
    rework_detail: str = Field(..., min_length=1, max_length=200)
    copq_cost: float = Field(..., ge=0)
    description: Optional[str] = None
    category_id: Optional[str] = None

class ReworkConfigUpdateBody(BaseModel):
    rework_detail: Optional[str] = Field(None, min_length=1, max_length=200)
    copq_cost: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    category_id: Optional[str] = None


@router.get("/rework-configs")
async def list_rework_configs(
    active_only: bool = Query(False),
    category_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List rework config types, optionally filtered by category."""
    q = db.query(ReworkConfig)
    if active_only:
        q = q.filter(ReworkConfig.is_active == True)
    if category_id is not None:
        q = q.filter(ReworkConfig.category_id == category_id)
    configs = q.order_by(ReworkConfig.rework_detail).all()
    return {"rework_configs": [_rework_config_dict(rc) for rc in configs]}


@router.post("/rework-configs", status_code=status.HTTP_201_CREATED)
async def create_rework_config(
    body: ReworkConfigCreateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Create a new rework config type."""
    if body.category_id:
        cat = db.query(ReworkCategory).filter(ReworkCategory.id == body.category_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")
    dup_q = db.query(ReworkConfig).filter(
        ReworkConfig.rework_detail == body.rework_detail,
        ReworkConfig.category_id == body.category_id,
    )
    if dup_q.first():
        raise HTTPException(status_code=409, detail="Rework detail already exists in this category")
    rc = ReworkConfig(
        id=uuid.uuid4(),
        category_id=body.category_id,
        rework_detail=body.rework_detail,
        copq_cost=body.copq_cost,
        description=body.description,
    )
    db.add(rc)
    db.commit()
    db.refresh(rc)
    return _rework_config_dict(rc)


@router.put("/rework-configs/{config_id}")
async def update_rework_config(
    config_id: str,
    body: ReworkConfigUpdateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Update a rework config type."""
    rc = db.query(ReworkConfig).filter(ReworkConfig.id == config_id).first()
    if not rc:
        raise HTTPException(status_code=404, detail="Rework config not found")
    target_category_id = body.category_id if body.category_id is not None else rc.category_id
    target_detail = body.rework_detail if body.rework_detail is not None else rc.rework_detail
    if body.rework_detail is not None or body.category_id is not None:
        dup = db.query(ReworkConfig).filter(
            ReworkConfig.rework_detail == target_detail,
            ReworkConfig.category_id == target_category_id,
            ReworkConfig.id != rc.id,
        ).first()
        if dup:
            raise HTTPException(status_code=409, detail="Rework detail already exists in this category")
    if body.rework_detail is not None:
        rc.rework_detail = body.rework_detail
    if body.copq_cost is not None:
        rc.copq_cost = body.copq_cost
    if body.description is not None:
        rc.description = body.description
    if body.is_active is not None:
        rc.is_active = body.is_active
    if body.category_id is not None:
        rc.category_id = body.category_id
    rc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rc)
    return _rework_config_dict(rc)


@router.delete("/rework-configs/{config_id}")
async def delete_rework_config(
    config_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Permanently delete a rework config type."""
    rc = db.query(ReworkConfig).filter(ReworkConfig.id == config_id).first()
    if not rc:
        raise HTTPException(status_code=404, detail="Rework config not found")
    db.delete(rc)
    db.commit()
    return {"message": "Rework config deleted", "id": config_id}


# ========== Standalone Production Target (daily) ==========

class DailyTargetBody(BaseModel):
    target_quantity: int = Field(..., ge=1)


@router.get("/production-target/today")
async def get_today_target(db: Session = Depends(get_db)):
    """Get today's production target (or latest incomplete)."""
    today = date.today()
    target = db.query(ProductionTarget).filter(ProductionTarget.target_date == today).first()
    if not target:
        # Fall back to latest incomplete
        target = (
            db.query(ProductionTarget)
            .filter(ProductionTarget.is_completed == False)
            .order_by(ProductionTarget.target_date.desc())
            .first()
        )
    if not target:
        return {"target": None}
    return {
        "target": {
            "id": str(target.id),
            "target_date": target.target_date.isoformat(),
            "target_quantity": target.target_quantity,
            "is_completed": target.is_completed,
            "completed_at": target.completed_at.isoformat() if target.completed_at else None,
            "created_at": target.created_at.isoformat() if target.created_at else None,
            "updated_at": target.updated_at.isoformat() if target.updated_at else None,
        }
    }


@router.post("/production-target/today")
async def set_today_target(
    body: DailyTargetBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Set or update today's production target."""
    today = date.today()
    target = db.query(ProductionTarget).filter(ProductionTarget.target_date == today).first()
    if target:
        target.target_quantity = body.target_quantity
        target.updated_at = datetime.utcnow()
    else:
        target = ProductionTarget(
            id=uuid.uuid4(),
            target_date=today,
            target_quantity=body.target_quantity,
        )
        db.add(target)

    # Sync the active product's production_target so analytics bar chart stays up to date
    active_product = db.query(Product).filter(Product.is_active == True).first()
    if active_product:
        active_product.production_target = body.target_quantity
        if active_product.target_status == "not_set":
            active_product.target_status = "in_progress"
        active_product.target_set_at = datetime.utcnow()
        active_product.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(target)
    return {
        "target": {
            "id": str(target.id),
            "target_date": target.target_date.isoformat(),
            "target_quantity": target.target_quantity,
            "is_completed": target.is_completed,
            "completed_at": target.completed_at.isoformat() if target.completed_at else None,
            "created_at": target.created_at.isoformat() if target.created_at else None,
            "updated_at": target.updated_at.isoformat() if target.updated_at else None,
        }
    }


@router.post("/production-target/complete")
async def mark_target_complete(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Mark today's production target as completed."""
    today = date.today()
    target = db.query(ProductionTarget).filter(ProductionTarget.target_date == today).first()
    if not target:
        raise HTTPException(status_code=404, detail="No target set for today")
    target.is_completed = True
    target.completed_at = datetime.utcnow()
    target.updated_at = datetime.utcnow()

    # Sync the active product's target_status
    active_product = db.query(Product).filter(Product.is_active == True).first()
    if active_product:
        active_product.target_status = "completed"
        active_product.target_completed_at = datetime.utcnow()
        active_product.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(target)
    return {"message": "Target marked as completed", "target": {
        "id": str(target.id),
        "target_date": target.target_date.isoformat(),
        "target_quantity": target.target_quantity,
        "is_completed": target.is_completed,
        "completed_at": target.completed_at.isoformat() if target.completed_at else None,
    }}


# ========== Operators ==========

class OperatorCreateBody(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    station_id: Optional[str] = None

class OperatorUpdateBody(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    station_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


def _operator_dict(o: Operator):
    return {
        "id": str(o.id),
        "username": o.username,
        "full_name": o.full_name,
        "role": o.role,
        "station_id": o.station_id,
        "is_active": o.is_active,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


@router.get("/operators")
async def list_operators(
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Operator)
    if role:
        q = q.filter(Operator.role == role)
    if is_active is not None:
        q = q.filter(Operator.is_active == is_active)
    operators = q.order_by(Operator.full_name).all()
    return {"operators": [_operator_dict(o) for o in operators]}


@router.post("/operators", status_code=status.HTTP_201_CREATED)
async def create_operator(
    body: OperatorCreateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing = db.query(Operator).filter(Operator.username == body.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
    o = Operator(
        id=uuid.uuid4(),
        username=body.username,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        station_id=body.station_id,
        is_active=True,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return _operator_dict(o)


@router.put("/operators/{operator_id}")
async def update_operator(
    operator_id: str,
    body: OperatorUpdateBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    o = db.query(Operator).filter(Operator.id == operator_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Operator not found")
    if body.username is not None:
        dup = db.query(Operator).filter(
            Operator.username == body.username, Operator.id != o.id
        ).first()
        if dup:
            raise HTTPException(status_code=409, detail="Username already exists")
        o.username = body.username
    if body.full_name is not None:
        o.full_name = body.full_name
    if body.role is not None:
        o.role = body.role
    if body.station_id is not None:
        o.station_id = body.station_id
    if body.is_active is not None:
        o.is_active = body.is_active
    if body.password:
        o.password_hash = hash_password(body.password)
    o.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(o)
    return _operator_dict(o)


@router.delete("/operators/{operator_id}")
async def delete_operator(
    operator_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Delete an operator (blocked if scan records exist)."""
    o = db.query(Operator).filter(Operator.id == operator_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Operator not found")
    if o.role == "admin" and o.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete the default admin user")
    scan_count = db.query(ScanRecord).filter(ScanRecord.operator_id == operator_id).count()
    if scan_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete operator with {scan_count} existing scan records. Deactivate instead.",
        )
    db.delete(o)
    db.commit()
    return {"message": "Operator deleted", "id": operator_id}
