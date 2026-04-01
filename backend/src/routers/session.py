"""Session display endpoints for latest scans and today's count."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from src.database import get_db
from src.models import ScanRecord, WorkOrder, ProductionStage, Operator, ProductStage
import uuid as uuid_mod

router = APIRouter(prefix="/api/v1/session", tags=["session"])


@router.get("/latest")
async def get_latest_scans(
    limit: int = Query(10, ge=1, le=100),
    stage_id: Optional[str] = Query(None),
    operator_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get latest scan records for session display, with optional stage/operator/product filters."""
    q = (
        db.query(ScanRecord)
        .join(WorkOrder, ScanRecord.work_order_id == WorkOrder.id)
        .join(ProductionStage, ScanRecord.stage_id == ProductionStage.id)
    )

    if stage_id:
        q = q.filter(ScanRecord.stage_id == stage_id)
    if operator_id:
        q = q.filter(ScanRecord.operator_id == operator_id)
    if product_id:
        q = q.filter(WorkOrder.product_id == product_id)

    scans = q.order_by(ScanRecord.scan_timestamp.desc()).limit(limit).all()

    result = []
    for s in scans:
        op = db.query(Operator).filter(Operator.id == s.operator_id).first()
        qi = db.query(Operator).filter(Operator.id == s.quality_inspector_id).first() if s.quality_inspector_id else None
        supervisor = db.query(Operator).filter(Operator.id == s.supervisor_id).first() if s.supervisor_id else None

        result.append({
            "id": str(s.id),
            "work_order_id": str(s.work_order_id),
            "work_order_code": s.work_order.work_order_code,
            "serial_number": s.work_order.serial_number,
            "stage_id": str(s.stage_id),
            "stage_name": s.stage.stage_name,
            "operator_id": str(s.operator_id),
            "operator_name": op.full_name if op else "Unknown",
            "station_id": op.station_id if op else None,
            "supervisor_id": str(s.supervisor_id) if s.supervisor_id else None,
            "supervisor_name": supervisor.full_name if supervisor else None,
            "scan_type": s.scan_type,
            "quality_status": s.quality_status,
            "is_first_article": s.is_first_article,
            "quality_inspector_id": str(s.quality_inspector_id) if s.quality_inspector_id else None,
            "quality_inspector_name": qi.full_name if qi else None,
            "previous_quality_status": s.previous_quality_status,
            "scan_timestamp": s.scan_timestamp.isoformat() if s.scan_timestamp else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    count_q = db.query(func.count(ScanRecord.id)).join(WorkOrder, ScanRecord.work_order_id == WorkOrder.id)
    if stage_id:
        count_q = count_q.filter(ScanRecord.stage_id == stage_id)
    if product_id:
        count_q = count_q.filter(WorkOrder.product_id == product_id)
    total_count = count_q.scalar() or 0
    return {"scans": result, "total_count": total_count}


@router.get("/today-count")
async def get_today_count(
    stage_id: Optional[str] = Query(None),
    operator_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get unique work order count for today, with optional stage/operator/product filters."""
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)

    q = (
        db.query(func.count(func.distinct(ScanRecord.work_order_id)))
        .join(WorkOrder, ScanRecord.work_order_id == WorkOrder.id)
        .filter(ScanRecord.scan_timestamp >= today_start)
    )
    if stage_id:
        q = q.filter(ScanRecord.stage_id == stage_id)
    if operator_id:
        q = q.filter(ScanRecord.operator_id == operator_id)
    if product_id:
        q = q.filter(WorkOrder.product_id == product_id)

    count = q.scalar() or 0
    return {"unique_work_orders": count, "date": today.isoformat()}


@router.get("/stage-defect-counts")
async def get_stage_defect_counts(
    product_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get today's not_ok scan count per stage, optionally filtered by product."""
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)

    q = (
        db.query(ScanRecord.stage_id, func.count(ScanRecord.id))
        .join(WorkOrder, ScanRecord.work_order_id == WorkOrder.id)
        .filter(ScanRecord.scan_timestamp >= today_start)
        .filter(ScanRecord.quality_status == "not_ok")
    )
    if product_id:
        q = q.filter(WorkOrder.product_id == product_id)

    rows = q.group_by(ScanRecord.stage_id).all()
    return {
        "counts": [
            {"stage_id": str(stage_id), "defect_count": count}
            for stage_id, count in rows
        ],
        "date": today.isoformat(),
    }


@router.get("/products-today-counts")
async def get_products_today_counts(db: Session = Depends(get_db)):
    """Get unique work order count per product for today, based only on the last stage scans."""
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)

    # Subquery: find the max sequence per product
    max_seq_subq = (
        db.query(
            ProductStage.product_id,
            func.max(ProductStage.sequence).label("max_seq"),
        )
        .group_by(ProductStage.product_id)
        .subquery()
    )

    # Subquery: get the stage_id that corresponds to the last stage for each product
    last_stage_subq = (
        db.query(ProductStage.product_id, ProductStage.stage_id)
        .join(
            max_seq_subq,
            (ProductStage.product_id == max_seq_subq.c.product_id)
            & (ProductStage.sequence == max_seq_subq.c.max_seq),
        )
        .subquery()
    )

    # Count distinct work orders scanned at the last stage today, per product
    rows = (
        db.query(last_stage_subq.c.product_id, func.count(func.distinct(ScanRecord.work_order_id)))
        .join(ScanRecord, ScanRecord.stage_id == last_stage_subq.c.stage_id)
        .join(WorkOrder, ScanRecord.work_order_id == WorkOrder.id)
        .filter(ScanRecord.scan_timestamp >= today_start)
        .filter(WorkOrder.product_id == last_stage_subq.c.product_id)
        .group_by(last_stage_subq.c.product_id)
        .all()
    )
    return {
        "counts": [
            {"product_id": str(product_id), "count": count}
            for product_id, count in rows
        ],
        "date": today.isoformat(),
    }


class SessionDataBody(BaseModel):
    stage_id: uuid_mod.UUID
    operator_id: Optional[uuid_mod.UUID] = None
    limit: int = 50


@router.post("/session-data")
async def get_session_data(
    body: SessionDataBody,
    db: Session = Depends(get_db),
):
    """Get scan records filtered by stage (and optionally operator)."""
    q = (
        db.query(ScanRecord)
        .filter(ScanRecord.stage_id == body.stage_id)
    )
    if body.operator_id:
        q = q.filter(ScanRecord.operator_id == body.operator_id)

    scans = q.order_by(ScanRecord.scan_timestamp.desc()).limit(body.limit).all()

    result = []
    for s in scans:
        wo = db.query(WorkOrder).filter(WorkOrder.id == s.work_order_id).first()
        op = db.query(Operator).filter(Operator.id == s.operator_id).first()
        supervisor = db.query(Operator).filter(Operator.id == s.supervisor_id).first() if s.supervisor_id else None

        result.append({
            "id": str(s.id),
            "work_order_id": str(s.work_order_id),
            "work_order_code": wo.work_order_code if wo else "",
            "serial_number": wo.serial_number if wo else None,
            "stage_id": str(s.stage_id),
            "operator_name": op.full_name if op else "Unknown",
            "supervisor_name": supervisor.full_name if supervisor else None,
            "scan_type": s.scan_type,
            "quality_status": s.quality_status,
            "is_first_article": s.is_first_article,
            "scan_timestamp": s.scan_timestamp.isoformat() if s.scan_timestamp else None,
        })

    return {"scans": result, "count": len(result)}
