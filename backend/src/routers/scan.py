"""Barcode scanning endpoints."""
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import Optional
from src.database import get_db
from src.schemas.scan import (
    ScanRequest, ScanResponse, WorkOrderStatusResponse,
    QualityStatusUpdateRequest, QualityStatusUpdateResponse
)
from src.schemas.rework import ApplyReworkBody
from src.services import scan as scan_service
from src.services import quality as quality_service
from src.services import rework as rework_service
from src.models import ScanRecord, ProductionStage, WorkOrder, Operator, Product, ProductStage
from src.auth.rbac import require_role
import uuid
import asyncio

router = APIRouter(prefix="/api/v1/scan", tags=["scan"])


@router.post("", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
async def process_scan(
    scan_request: ScanRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("operator", "quality_inspector", "supervisor", "admin"))
):
    """Process barcode scan for a production stage."""
    return scan_service.process_scan(db, scan_request)


@router.get("/work-order/{work_order_barcode}", response_model=WorkOrderStatusResponse)
async def get_work_order_status(
    work_order_barcode: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("operator", "quality_inspector", "supervisor", "admin"))
):
    """Get work order details and current status."""
    return scan_service.get_work_order_status(db, work_order_barcode)


@router.put("/{scan_id}/quality", response_model=QualityStatusUpdateResponse, status_code=status.HTTP_200_OK)
async def update_scan_quality_status(
    scan_id: uuid.UUID,
    update_request: QualityStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("operator", "quality_inspector", "supervisor", "admin"))
):
    """Update quality status of a scan record."""
    scan_record, status_log = quality_service.update_quality_status(
        db,
        scan_id,
        update_request.new_status,
        update_request.operator_id,
        update_request.reason
    )

    quality_service.calculate_copq_impact(
        db,
        scan_record.work_order_id,
        scan_record.stage_id,
        update_request.new_status
    )

    from src.models import Operator, ProductionStage, WorkOrder
    operator = db.query(Operator).filter(Operator.id == update_request.operator_id).first()
    stage = db.query(ProductionStage).filter(ProductionStage.id == scan_record.stage_id).first()
    work_order = db.query(WorkOrder).filter(WorkOrder.id == scan_record.work_order_id).first()

    response = QualityStatusUpdateResponse(
        scan_id=scan_record.id,
        work_order_id=scan_record.work_order_id,
        barcode=work_order.work_order_code,
        stage_name=stage.stage_name,
        previous_status=status_log.previous_status,
        new_status=status_log.new_status,
        updated_by=operator.full_name,
        updated_at=status_log.changed_at,
        message="Quality status updated successfully"
    )

    try:
        from src.websocket.manager import manager
        asyncio.create_task(manager.broadcast_quality_update({
            "scan_id": str(response.scan_id),
            "work_order_id": str(response.work_order_id),
            "barcode": response.barcode,
            "stage_name": response.stage_name,
            "previous_status": response.previous_status,
            "new_status": response.new_status,
            "updated_by": response.updated_by,
            "updated_at": response.updated_at.isoformat() if response.updated_at else None
        }))
    except Exception as e:
        import logging
        logging.error(f"Failed to broadcast quality update event: {e}")

    return response


# ========== Rejected Cables & Rework ==========

@router.get("/rejected-cables")
async def get_rejected_cables(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    no_rework_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Get paginated list of rejected (NOT OK) cables with rework info."""
    sd = date.fromisoformat(start_date) if start_date else None
    ed = date.fromisoformat(end_date) if end_date else None
    return rework_service.get_rejected_cables(db, page, per_page, sd, ed, no_rework_only)


@router.post("/apply-rework")
async def apply_rework(
    body: ApplyReworkBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Apply rework to a rejected cable."""
    return rework_service.apply_rework(
        db,
        body.scan_record_id,
        body.work_order_id,
        body.rework_config_id,
        body.applied_by,
        body.notes,
    )


@router.put("/rework-history/{rework_id}")
async def update_rework(
    rework_id: uuid.UUID,
    rework_config_id: uuid.UUID = Query(...),
    applied_by: str = Query(...),
    notes: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Change rework type for an existing rework history entry."""
    return rework_service.update_rework_type(db, rework_id, rework_config_id, applied_by, notes)


@router.get("/copq-summary")
async def get_copq_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """COPQ summary with date filters from rework_history."""
    sd = date.fromisoformat(start_date) if start_date else None
    ed = date.fromisoformat(end_date) if end_date else None
    return rework_service.get_copq_summary(db, sd, ed)


# ========== Rework History ==========

@router.get("/rework-history-for-scan/{scan_record_id}")
async def get_rework_history_for_scan(
    scan_record_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Get all rework history entries (active + past) for a scan record."""
    return rework_service.get_rework_history_for_scan(db, scan_record_id)


# ========== Stage Validation ==========

@router.get("/check-previous-stage")
async def check_previous_stage(
    barcode: str = Query(...),
    stage_id: str = Query(...),
    product_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("operator", "quality_inspector", "supervisor", "admin")),
):
    """Check if all previous stages are completed for a work order.
    Uses product-specific stage ordering from product_stages table."""

    # Determine product_id — prefer the operator's explicitly selected product,
    # then fall back to the work order's product, then active product.
    wo = db.query(WorkOrder).filter(WorkOrder.work_order_code == barcode.upper()).first()
    if product_id:
        pid = product_id
    elif wo:
        pid = wo.product_id
    else:
        # Fall back to active product
        active = db.query(Product).filter(Product.is_active == True).first()
        pid = active.id if active else None

    if not pid:
        return {"valid": True, "missing_stages": []}

    # Get current stage's product-specific sequence
    current_ps = db.query(ProductStage).filter(
        ProductStage.product_id == pid,
        ProductStage.stage_id == stage_id,
    ).first()
    if not current_ps:
        return {"valid": False, "missing_stages": [], "error": "Stage not assigned to product"}

    current_seq = current_ps.sequence

    # Get all product stages with lower sequence
    previous_product_stages = (
        db.query(ProductStage, ProductionStage)
        .join(ProductionStage, ProductionStage.id == ProductStage.stage_id)
        .filter(
            ProductStage.product_id == pid,
            ProductStage.sequence < current_seq,
        )
        .order_by(ProductStage.sequence)
        .all()
    )

    if not wo:
        # New work order — must start at the first product stage
        if previous_product_stages:
            missing = [
                {"stage_name": ps.stage_name, "stage_sequence": ps_assoc.sequence}
                for ps_assoc, ps in previous_product_stages
            ]
            return {"valid": False, "missing_stages": missing}
        return {"valid": True, "missing_stages": []}

    # Existing work order — check all previous product stages have OK scans
    missing = []
    for ps_assoc, ps in previous_product_stages:
        scan = (
            db.query(ScanRecord)
            .filter(
                ScanRecord.work_order_id == wo.id,
                ScanRecord.stage_id == ps_assoc.stage_id,
                ScanRecord.quality_status.in_(["ok", "ok_update"]),
            )
            .first()
        )
        if not scan:
            missing.append({
                "stage_name": ps.stage_name,
                "stage_sequence": ps_assoc.sequence,
            })

    return {"valid": len(missing) == 0, "missing_stages": missing}


# ========== First Article Status ==========

@router.get("/first-article-status")
async def get_first_article_status(
    target_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("operator", "quality_inspector", "supervisor", "admin")),
):
    """Return which stages have completed first article today."""
    if target_date:
        d = date.fromisoformat(target_date)
    else:
        d = datetime.utcnow().date()

    day_start = datetime(d.year, d.month, d.day)
    day_end = datetime(d.year, d.month, d.day, 23, 59, 59)

    stages = db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()
    result = []
    for s in stages:
        fa_scan = (
            db.query(ScanRecord)
            .filter(
                ScanRecord.stage_id == s.id,
                ScanRecord.is_first_article == True,
                ScanRecord.scan_timestamp >= day_start,
                ScanRecord.scan_timestamp <= day_end,
            )
            .first()
        )
        result.append({
            "stage_id": str(s.id),
            "stage_name": s.stage_name,
            "stage_sequence": s.stage_sequence,
            "first_article_completed": fa_scan is not None,
            "completed_at": fa_scan.scan_timestamp.isoformat() if fa_scan else None,
        })

    return {"date": d.isoformat(), "stages": result}
